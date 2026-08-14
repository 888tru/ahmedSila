// Package authprovider — реализации domain.AuthProvider.
//
// В MVP она одна — по паролю. SSO/OIDC добавляется сюда же вторым файлом,
// usecase-слой при этом не меняется.
package authprovider

import (
	"context"
	"errors"
	"strings"

	"github.com/ahmedsila/superadmin/internal/domain"
)

// Password проверяет пару email+пароль по нашей БД.
type Password struct {
	users  domain.SuperAdminRepository
	hasher domain.PasswordHasher
}

var _ domain.AuthProvider = (*Password)(nil)

func NewPassword(users domain.SuperAdminRepository, hasher domain.PasswordHasher) *Password {
	return &Password{users: users, hasher: hasher}
}

func (p *Password) Name() string { return "password" }

func (p *Password) Authenticate(ctx context.Context, c domain.Credentials) (*domain.SuperAdminUser, error) {
	email := NormalizeEmail(c.Email)

	user, err := p.users.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			// Тратим то же время, что и на настоящую проверку хеша,
			// иначе по времени ответа видно, существует ли учётка.
			p.hasher.DummyVerify()
			return nil, domain.ErrInvalidCredentials
		}
		return nil, err
	}

	ok, err := p.hasher.Verify(c.Password, user.PasswordHash)
	if err != nil {
		// Битый хеш в БД — это наша проблема, а не пользователя: не выдаём
		// ErrInvalidCredentials, чтобы ошибка попала в мониторинг как 500.
		return nil, err
	}
	if !ok {
		// Пользователь возвращается вместе с ошибкой: вызывающему нужно
		// увеличить счётчик неудачных попыток именно для него.
		return user, domain.ErrInvalidCredentials
	}

	return user, nil
}

// NormalizeEmail приводит email к каноничному виду. В БД колонка citext,
// но полагаться только на неё нельзя: сравнения бывают и вне SQL.
func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}
