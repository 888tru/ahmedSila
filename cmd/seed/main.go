// Команда seed наполняет пустую БД демо-данными: первый owner, ещё несколько
// сотрудников команды, клиенты и обращения — та же выборка, что раньше жила
// только в мок-сторах фронтенда (features/clients/mock.ts,
// features/tickets/mock.ts, features/team/mock.ts), чтобы экраны на реальном
// бэкенде выглядели так же наполненно, как на моках.
//
// Идемпотентна по email/названию: повторный запуск не плодит дубликаты
// (пропускает то, что уже есть).
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/ahmedsila/superadmin/internal/pkg/config"
	"github.com/ahmedsila/superadmin/internal/pkg/hash"
	"github.com/ahmedsila/superadmin/internal/repository/postgres"
)

// seedPassword — единый пароль для всех сидовых сотрудников: это дев-стенд,
// не прод, различать пароли по сотрудникам смысла нет.
const seedPassword = "password123"

type teamSeed struct {
	name string
	slug string // до "@example.kz"
	role string
	tfa  bool
}

var team = []teamSeed{
	{"Айдар Керимов", "a.kerimov", "owner", true},
	{"Динара Тлеубаева", "d.tleubaeva", "admin", true},
	{"Сауле Молдагалиева", "s.moldagalieva", "support", true},
	{"Руслан Алиев", "r.aliev", "support", false},
	{"Мария Штерн", "m.shtern", "viewer", false},
}

type tenantSeed struct {
	name      string
	city      string
	status    string
	plan      string
	employees int
	trialDays int // 0 — не триал
}

var tenants = []tenantSeed{
	{"Магнум Экспресс", "Алматы", "active", "Growth", 34, 0},
	{"Продукты у дома №4", "Караганда", "trial", "Starter", 6, 4},
	{"Светофор Тараз", "Тараз", "active", "Growth", 51, 0},
	{"Айсберг Маркет", "Астана", "paused", "Starter", 12, 0},
	{"Береке Супермаркет", "Шымкент", "active", "Enterprise", 88, 0},
	{"Дастархан", "Актобе", "trial", "Starter", 4, 2},
	{"Смак на Абая", "Алматы", "active", "Starter", 19, 0},
	{"Гросс Опт", "Павлодар", "active", "Enterprise", 126, 0},
	{"Ануар Фрукты", "Кызылорда", "paused", "Starter", 8, 0},
	{"Небо Маркет", "Усть-Каменогорск", "active", "Growth", 41, 0},
	{"Апельсин", "Семей", "trial", "Growth", 11, 9},
	{"Титан Ритейл", "Атырау", "active", "Growth", 63, 0},
	{"Куаныш Маркет", "Костанай", "active", "Starter", 22, 0},
	{"Наурыз Продукты", "Уральск", "paused", "Starter", 15, 0},
	{"Восточный Базар", "Туркестан", "active", "Growth", 37, 0},
	{"Родник", "Актау", "trial", "Starter", 9, 1},
}

type ticketMessageSeed struct {
	author     string // client | team
	authorName string
	daysAgo    float64
}

type ticketSeed struct {
	tenantName  string
	subject     string
	status      string
	priority    string
	assignee    string // "" — не назначен
	contactName string
	messages    []ticketMessageSeed
}

var tickets = []ticketSeed{
	{"Береке Супермаркет", "Не приходит код подтверждения на почту", "in_progress", "high", "Айдар Керимов", "Ержан Сапаров", []ticketMessageSeed{
		{"client", "Ержан Сапаров", 4.8}, {"team", "Айдар Керимов", 4.1},
		{"client", "Ержан Сапаров", 3.9}, {"team", "Айдар Керимов", 3.8},
	}},
	{"Смак на Абая", "Добавить сотрудника сверх лимита тарифа", "open", "normal", "", "Асель Нурланова", []ticketMessageSeed{
		{"client", "Асель Нурланова", 4.2},
	}},
	{"Магнум Экспресс", "Оператор не видит заявки после смены", "open", "high", "", "Дамир Ералиев", []ticketMessageSeed{
		{"client", "Дамир Ералиев", 4.4},
	}},
	{"Гросс Опт", "Просим перенести дату списания", "in_progress", "normal", "Динара Тлеубаева", "Ольга Ким", []ticketMessageSeed{
		{"client", "Ольга Ким", 6.9}, {"team", "Динара Тлеубаева", 5.9},
	}},
	{"Айсберг Маркет", "Восстановить доступ после приостановки", "in_progress", "high", "Айдар Керимов", "Тимур Абдиров", []ticketMessageSeed{
		{"client", "Тимур Абдиров", 6.1}, {"team", "Айдар Керимов", 5.9},
	}},
	{"Небо Маркет", "Ошибка при входе оператора смены", "resolved", "normal", "Динара Тлеубаева", "Марат Жунусов", []ticketMessageSeed{
		{"client", "Марат Жунусов", 12.7}, {"team", "Динара Тлеубаева", 12.6}, {"client", "Марат Жунусов", 11.7},
	}},
	{"Титан Ритейл", "Как поменять владельца аккаунта", "resolved", "low", "Сауле Молдагалиева", "Ирина Пак", []ticketMessageSeed{
		{"client", "Ирина Пак", 14.6}, {"team", "Сауле Молдагалиева", 14.5},
	}},
	{"Береке Супермаркет", "Перенос данных из старой системы", "closed", "low", "Айдар Керимов", "Ержан Сапаров", []ticketMessageSeed{
		{"client", "Ержан Сапаров", 69.0}, {"team", "Айдар Керимов", 67.0},
	}},
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "seed не выполнен:", err)
		os.Exit(1)
	}
	fmt.Println("Готово. Пароль для входа у всех сотрудников:", seedPassword)
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx := context.Background()
	pool, err := postgres.NewPool(ctx, postgres.PoolConfig{URL: cfg.DB.URL, MaxConns: cfg.DB.MaxConns})
	if err != nil {
		return err
	}
	defer pool.Close()

	hasher := hash.NewArgon2(hash.DefaultParams())
	pwHash, err := hasher.Hash(seedPassword)
	if err != nil {
		return fmt.Errorf("хеширование пароля: %w", err)
	}

	userID := map[string]string{}
	for _, m := range team {
		email := m.slug + "@example.kz"
		var id string
		err := pool.QueryRow(ctx, `SELECT id FROM super_admin_users WHERE email = $1`, email).Scan(&id)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("поиск сотрудника %s: %w", m.name, err)
		}
		if errors.Is(err, pgx.ErrNoRows) {
			totpSecret := ""
			var totpEnrolledAt *time.Time
			if m.tfa {
				totpSecret = "seed-totp-secret"
				now := time.Now().UTC()
				totpEnrolledAt = &now
			}
			err = pool.QueryRow(ctx, `
				INSERT INTO super_admin_users (email, full_name, password_hash, role, status, totp_secret, totp_enrolled_at)
				VALUES ($1, $2, $3, $4, 'active', NULLIF($5, ''), $6)
				RETURNING id`,
				email, m.name, pwHash, m.role, totpSecret, totpEnrolledAt,
			).Scan(&id)
			if err != nil {
				return fmt.Errorf("создание сотрудника %s: %w", m.name, err)
			}
			fmt.Println("создан сотрудник:", m.name, email)
		}
		userID[m.name] = id
	}

	tenantID := map[string]string{}
	now := time.Now().UTC()
	for _, t := range tenants {
		// Не транслитерируем название клиента в домен: почти все имена
		// в списке — кириллица, slugify() всё равно выбросил бы их целиком.
		email := fmt.Sprintf("owner-%d@client.kz", len(tenantID)+1)
		var id string
		err := pool.QueryRow(ctx, `SELECT id FROM tenants WHERE name = $1`, t.name).Scan(&id)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("поиск клиента %s: %w", t.name, err)
		}
		if errors.Is(err, pgx.ErrNoRows) {
			var trialEndsAt *time.Time
			status := t.status
			if t.trialDays > 0 {
				exp := now.AddDate(0, 0, t.trialDays)
				trialEndsAt = &exp
			}
			lastActive := now.Add(-time.Duration(30+len(tenantID)*7) * time.Minute)
			err = pool.QueryRow(ctx, `
				INSERT INTO tenants (name, city, address, status, plan, employees, owner_name, phone, email, last_active_at, trial_ends_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
				RETURNING id`,
				t.name, t.city, t.city+", "+fmt.Sprintf("ул. Сатпаева %d", 10+len(tenantID)),
				status, t.plan, t.employees, fmt.Sprintf("Владелец %s", t.name), "+7 701 000 00 0"+fmt.Sprint(len(tenantID)%10),
				email, lastActive, trialEndsAt,
			).Scan(&id)
			if err != nil {
				return fmt.Errorf("создание клиента %s: %w", t.name, err)
			}
			fmt.Println("создан клиент:", t.name)
		}
		tenantID[t.name] = id
	}

	for _, tk := range tickets {
		tid, ok := tenantID[tk.tenantName]
		if !ok {
			return fmt.Errorf("обращение %q ссылается на неизвестного клиента %q", tk.subject, tk.tenantName)
		}
		var exists bool
		if err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM support_tickets WHERE tenant_id = $1 AND subject = $2)`, tid, tk.subject).Scan(&exists); err != nil {
			return fmt.Errorf("проверка обращения %q: %w", tk.subject, err)
		}
		if exists {
			continue
		}

		var assigneeID *string
		if tk.assignee != "" {
			id, ok := userID[tk.assignee]
			if !ok {
				return fmt.Errorf("обращение %q ссылается на неизвестного сотрудника %q", tk.subject, tk.assignee)
			}
			assigneeID = &id
		}

		var ticketID string
		if err := pool.QueryRow(ctx, `
			INSERT INTO support_tickets (tenant_id, subject, status, priority, assignee_id, contact_name)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id`,
			tid, tk.subject, tk.status, tk.priority, assigneeID, tk.contactName,
		).Scan(&ticketID); err != nil {
			return fmt.Errorf("создание обращения %q: %w", tk.subject, err)
		}

		for _, m := range tk.messages {
			sentAt := now.Add(-time.Duration(m.daysAgo*24) * time.Hour)
			var authorID *string
			if m.author == "team" {
				id, ok := userID[m.authorName]
				if !ok {
					return fmt.Errorf("сообщение в %q ссылается на неизвестного сотрудника %q", tk.subject, m.authorName)
				}
				authorID = &id
			}
			if _, err := pool.Exec(ctx, `
				INSERT INTO support_ticket_messages (ticket_id, author, author_name, author_id, body, sent_at)
				VALUES ($1, $2, $3, $4, $5, $6)`,
				ticketID, m.author, m.authorName, authorID, messageBody(tk.subject, m), sentAt,
			); err != nil {
				return fmt.Errorf("создание сообщения в %q: %w", tk.subject, err)
			}
		}
		fmt.Println("создано обращение:", tk.subject)
	}

	return nil
}

// messageBody — короткий, но осмысленный текст сообщения; дословный текст
// демо-переписки не критичен для сидовых данных, важно, что тред читается
// связно и в правильном порядке (см. sentAt выше).
func messageBody(subject string, m ticketMessageSeed) string {
	if m.author == "client" {
		return "Добрый день! По обращению «" + subject + "» — ждём обновления."
	}
	return "Приняли в работу, разбираемся с «" + subject + "»."
}
