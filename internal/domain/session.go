package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// RefreshToken — запись о выданном refresh-токене. ID совпадает с jti в claims.
//
// SessionID связывает цепочку ротаций: login выдаёт первый токен, каждый refresh
// помечает предыдущий использованным и выдаёт следующий с тем же SessionID.
// Если кто-то предъявляет уже использованный токен — значит токен утёк,
// и отзывается вся сессия целиком, а не только этот токен.
type RefreshToken struct {
	ID            uuid.UUID
	UserID        uuid.UUID
	SessionID     uuid.UUID
	TokenHash     []byte // SHA-256 от токена; сам токен не хранится
	ExpiresAt     time.Time
	UsedAt        *time.Time
	RevokedAt     *time.Time
	RevokedReason string
	ReplacedBy    *uuid.UUID
	UserAgent     string
	IP            string
	CreatedAt     time.Time
}

func (t *RefreshToken) IsExpired(now time.Time) bool { return !t.ExpiresAt.After(now) }
func (t *RefreshToken) IsRevoked() bool              { return t.RevokedAt != nil }
func (t *RefreshToken) IsUsed() bool                 { return t.UsedAt != nil }

// IsUsable — токен можно обменять на новую пару.
func (t *RefreshToken) IsUsable(now time.Time) bool {
	return !t.IsExpired(now) && !t.IsRevoked() && !t.IsUsed()
}

// Причины отзыва — попадают в audit_logs и помогают разбирать инциденты.
const (
	RevokeReasonLogout       = "logout"
	RevokeReasonReuse        = "refresh_token_reuse"
	RevokeReasonLogoutAll    = "logout_all_sessions"
	RevokeReasonUserDisabled = "user_disabled"
)

type RefreshTokenRepository interface {
	Create(ctx context.Context, t *RefreshToken) error
	// GetByHash возвращает ErrNotFound, если такого токена не выдавалось.
	GetByHash(ctx context.Context, hash []byte) (*RefreshToken, error)
	// MarkUsed помечает токен использованным и связывает его с преемником.
	MarkUsed(ctx context.Context, id, replacedBy uuid.UUID, at time.Time) error
	// RevokeSession отзывает все токены одной цепочки ротации.
	RevokeSession(ctx context.Context, sessionID uuid.UUID, reason string, at time.Time) error
	// RevokeAllForUser — «выйти на всех устройствах».
	RevokeAllForUser(ctx context.Context, userID uuid.UUID, reason string, at time.Time) error
	// DeleteExpired — периодическая чистка, вызывается фоновой задачей.
	DeleteExpired(ctx context.Context, before time.Time) (int64, error)
}

// TokenRevoker — revocation list в Redis: единственная сетевая проверка
// на пути запроса с access-токеном (TECH_STACK.md §1).
//
// Ключи живут ровно столько, сколько осталось жить токену, поэтому список
// не растёт неограниченно.
type TokenRevoker interface {
	Revoke(ctx context.Context, tokenID uuid.UUID, ttl time.Duration) error
	IsRevoked(ctx context.Context, tokenID uuid.UUID) (bool, error)
}
