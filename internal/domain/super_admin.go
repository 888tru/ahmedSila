package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Role — роль сотрудника внутри команды суперадминки.
// Значения совпадают с Postgres-энумом super_admin_role.
type Role string

const (
	RoleOwner   Role = "owner"
	RoleAdmin   Role = "admin"
	RoleSupport Role = "support"
	RoleViewer  Role = "viewer"
)

func (r Role) Valid() bool {
	switch r {
	case RoleOwner, RoleAdmin, RoleSupport, RoleViewer:
		return true
	default:
		return false
	}
}

// RequiresTOTP — роли с полным доступом обязаны иметь второй фактор (§7).
func (r Role) RequiresTOTP() bool {
	return r == RoleOwner || r == RoleAdmin
}

type UserStatus string

const (
	UserStatusActive    UserStatus = "active"
	UserStatusSuspended UserStatus = "suspended"
)

func (s UserStatus) Valid() bool {
	return s == UserStatusActive || s == UserStatusSuspended
}

// SuperAdminUser — сотрудник нашей команды. Не путать с пользователем тенанта:
// это разные контуры аутентификации (TECH_STACK.md §1).
type SuperAdminUser struct {
	ID                  uuid.UUID
	Email               string
	FullName            string
	PasswordHash        string
	Role                Role
	Status              UserStatus
	TOTPSecret          *string
	TOTPEnrolledAt      *time.Time
	FailedLoginAttempts int
	LockedUntil         *time.Time
	LastLoginAt         *time.Time
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

// IsLocked — учётка под lockout'ом после серии неудачных попыток входа.
func (u *SuperAdminUser) IsLocked(now time.Time) bool {
	return u.LockedUntil != nil && u.LockedUntil.After(now)
}

// EnsureCanLogin проверяет, что учётке вообще разрешено входить.
// Возвращает ErrAccountLocked или ErrInvalidCredentials — приостановленная
// учётка отвечает так же, как несуществующая, чтобы не раскрывать её статус.
func (u *SuperAdminUser) EnsureCanLogin(now time.Time) error {
	if u.IsLocked(now) {
		return ErrAccountLocked
	}
	if u.Status != UserStatusActive {
		return ErrInvalidCredentials
	}
	return nil
}

// SuperAdminRepository — порт хранилища сотрудников.
type SuperAdminRepository interface {
	Create(ctx context.Context, u *SuperAdminUser) error
	GetByID(ctx context.Context, id uuid.UUID) (*SuperAdminUser, error)
	// GetByEmail возвращает ErrNotFound, если пользователя нет.
	GetByEmail(ctx context.Context, email string) (*SuperAdminUser, error)
	List(ctx context.Context) ([]SuperAdminUser, error)

	// RegisterFailedLogin инкрементит счётчик попыток и, если передан lockedUntil,
	// выставляет блокировку. Атомарно, одним UPDATE.
	RegisterFailedLogin(ctx context.Context, id uuid.UUID, lockedUntil *time.Time) error
	// RegisterSuccessfulLogin сбрасывает счётчик и пишет last_login_at.
	RegisterSuccessfulLogin(ctx context.Context, id uuid.UUID, at time.Time) error
}
