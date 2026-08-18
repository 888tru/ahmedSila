package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Invitation — приглашение сотрудника в команду. Не путать с SuperAdminUser:
// пока приглашение не принято, у человека ещё нет ни пароля, ни строки в
// super_admin_users — accept-флоу появится вместе с реальной отправкой писем
// (CLAUDE.md, «Дальше»).
type Invitation struct {
	ID         uuid.UUID
	Email      string
	Role       Role
	TokenHash  []byte // SHA-256 от токена активации; сам токен не хранится
	InvitedBy  *uuid.UUID
	ExpiresAt  time.Time
	AcceptedAt *time.Time
	CreatedAt  time.Time
}

func (i *Invitation) IsExpired(now time.Time) bool { return !i.ExpiresAt.After(now) }
func (i *Invitation) IsAccepted() bool             { return i.AcceptedAt != nil }

type InvitationRepository interface {
	Create(ctx context.Context, inv *Invitation) error
	// HasPending — есть ли уже непринятое приглашение на этот email
	// (проверяется до Create, а не полагается на уникальный индекс: так
	// ошибка «этот сотрудник уже приглашён» доменная, а не «конфликт БД»).
	HasPending(ctx context.Context, email string) (bool, error)
}
