package handler

import (
	"fmt"

	"github.com/ahmedsila/superadmin/internal/domain"
)

// actionKind — карта известных действий на категорию экрана (PAGES.md §6):
// «Доступ»/«Клиенты»/«Подписка»/«Обращения»/«Команда». Новое действие без
// записи здесь попадает в «team» по умолчанию (см. kindOf) — заметно
// в интерфейсе, что запись не расклассифицирована, и это повод дописать карту,
// а не молча потерять фильтрацию.
var actionKind = map[string]string{
	domain.AuditLoginSuccess:               "access",
	domain.AuditLoginFailure:               "access",
	domain.AuditLogout:                     "access",
	domain.AuditTokenRefresh:               "access",
	domain.AuditTokenReuse:                 "access",
	domain.AuditSessionsRevoked:            "access",
	domain.AuditTenantCreated:              "clients",
	domain.AuditTenantUpdated:              "clients",
	domain.AuditTenantSuspended:            "access",
	domain.AuditTenantResumed:              "access",
	domain.AuditTenantActivationCodeIssued: "access",
	domain.AuditTenantDeleted:              "clients",
	domain.AuditSuperAdminCreate:           "team",
	domain.AuditSuperAdminInvited:          "team",
	domain.AuditSuperAdminRoleChanged:      "team",
	domain.AuditSuperAdminAccessRevoked:    "team",
	domain.AuditMessageTemplateUpdated:     "team",
	domain.AuditTicketReplied:              "tickets",
	domain.AuditTicketAssigned:             "tickets",
	domain.AuditTicketStatusChanged:        "tickets",
	domain.AuditTicketPriorityChanged:      "tickets",
}

func kindOf(action string) string {
	if kind, ok := actionKind[action]; ok {
		return kind
	}
	return "team"
}

// describeAction превращает запись аудита в читаемую русскую фразу для
// «Журнала действий» и «Обзора» (те же экраны, то же требование к тексту).
// Метаданные для неё пишутся усечёнными в usecase-слое (см. Tenant.writeAudit,
// Ticket.writeAudit, Team.Invite/UpdateRole/Revoke) — здесь их только читают.
func describeAction(e domain.AuditEntry) string {
	subject := metaString(e.Metadata, "subject")
	switch e.Action {
	case domain.AuditLoginSuccess:
		return "Вошёл в систему"
	case domain.AuditLoginFailure:
		return "Неудачная попытка входа"
	case domain.AuditLogout:
		return "Вышел из системы"
	case domain.AuditTokenRefresh:
		return "Обновил сессию"
	case domain.AuditTokenReuse:
		return "Обнаружено повторное использование refresh-токена — сессия отозвана"
	case domain.AuditSessionsRevoked:
		return "Завершил все сессии"
	case domain.AuditTenantCreated:
		return fmt.Sprintf("Создал клиента, тариф %s", metaString(e.Metadata, "plan"))
	case domain.AuditTenantUpdated:
		return "Изменил данные клиента"
	case domain.AuditTenantSuspended:
		return fmt.Sprintf("Приостановил доступ, причина: %s", metaString(e.Metadata, "reason"))
	case domain.AuditTenantResumed:
		return "Возобновил доступ"
	case domain.AuditTenantActivationCodeIssued:
		return "Сгенерировал новый код подтверждения"
	case domain.AuditTenantDeleted:
		return "Удалил клиента"
	case domain.AuditSuperAdminCreate:
		return "Создана учётная запись сотрудника"
	case domain.AuditSuperAdminInvited:
		return fmt.Sprintf("Пригласил сотрудника в команду: %s, роль «%s»", metaString(e.Metadata, "email"), metaString(e.Metadata, "role"))
	case domain.AuditSuperAdminRoleChanged:
		return fmt.Sprintf("Изменил роль сотрудника %s: %s → %s", metaString(e.Metadata, "email"), metaString(e.Metadata, "from"), metaString(e.Metadata, "to"))
	case domain.AuditSuperAdminAccessRevoked:
		return fmt.Sprintf("Отозвал доступ сотрудника: %s", metaString(e.Metadata, "email"))
	case domain.AuditMessageTemplateUpdated:
		return "Обновил шаблон сообщения с кодом подтверждения"
	case domain.AuditTicketReplied:
		return fmt.Sprintf("Ответил в обращении «%s»", subject)
	case domain.AuditTicketAssigned:
		return fmt.Sprintf("Назначил на себя обращение «%s»", subject)
	case domain.AuditTicketStatusChanged:
		return fmt.Sprintf("Изменил статус обращения «%s»", subject)
	case domain.AuditTicketPriorityChanged:
		return fmt.Sprintf("Изменил приоритет обращения «%s»", subject)
	default:
		return e.Action
	}
}

func metaString(m map[string]any, key string) string {
	v, ok := m[key]
	if !ok {
		return ""
	}
	s, ok := v.(string)
	if !ok {
		return ""
	}
	return s
}
