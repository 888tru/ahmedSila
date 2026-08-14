package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahmedsila/superadmin/internal/domain"
	"github.com/ahmedsila/superadmin/internal/repository/sqlc"
)

type RefreshTokenRepo struct {
	q *sqlc.Queries
}

var _ domain.RefreshTokenRepository = (*RefreshTokenRepo)(nil)

func NewRefreshTokenRepo(pool *pgxpool.Pool) *RefreshTokenRepo {
	return &RefreshTokenRepo{q: sqlc.New(pool)}
}

func (r *RefreshTokenRepo) Create(ctx context.Context, t *domain.RefreshToken) error {
	row, err := r.q.CreateRefreshToken(ctx, sqlc.CreateRefreshTokenParams{
		ID:        t.ID,
		UserID:    t.UserID,
		SessionID: t.SessionID,
		TokenHash: t.TokenHash,
		ExpiresAt: t.ExpiresAt,
		UserAgent: t.UserAgent,
		Ip:        t.IP,
	})
	if err != nil {
		return mapError(err)
	}
	*t = *toDomainToken(row)
	return nil
}

func (r *RefreshTokenRepo) GetByHash(ctx context.Context, hash []byte) (*domain.RefreshToken, error) {
	row, err := r.q.GetRefreshTokenByHash(ctx, hash)
	if err != nil {
		return nil, mapError(err)
	}
	return toDomainToken(row), nil
}

func (r *RefreshTokenRepo) MarkUsed(ctx context.Context, id, replacedBy uuid.UUID, at time.Time) error {
	return mapError(r.q.MarkRefreshTokenUsed(ctx, sqlc.MarkRefreshTokenUsedParams{
		ID:         id,
		UsedAt:     &at,
		ReplacedBy: &replacedBy,
	}))
}

func (r *RefreshTokenRepo) RevokeSession(ctx context.Context, sessionID uuid.UUID, reason string, at time.Time) error {
	return mapError(r.q.RevokeRefreshTokenSession(ctx, sqlc.RevokeRefreshTokenSessionParams{
		SessionID:     sessionID,
		RevokedAt:     &at,
		RevokedReason: &reason,
	}))
}

func (r *RefreshTokenRepo) RevokeAllForUser(ctx context.Context, userID uuid.UUID, reason string, at time.Time) error {
	return mapError(r.q.RevokeAllRefreshTokensForUser(ctx, sqlc.RevokeAllRefreshTokensForUserParams{
		UserID:        userID,
		RevokedAt:     &at,
		RevokedReason: &reason,
	}))
}

func (r *RefreshTokenRepo) DeleteExpired(ctx context.Context, before time.Time) (int64, error) {
	n, err := r.q.DeleteExpiredRefreshTokens(ctx, before)
	return n, mapError(err)
}

func toDomainToken(row sqlc.RefreshToken) *domain.RefreshToken {
	t := &domain.RefreshToken{
		ID:         row.ID,
		UserID:     row.UserID,
		SessionID:  row.SessionID,
		TokenHash:  row.TokenHash,
		ExpiresAt:  row.ExpiresAt,
		UsedAt:     row.UsedAt,
		RevokedAt:  row.RevokedAt,
		ReplacedBy: row.ReplacedBy,
		UserAgent:  row.UserAgent,
		IP:         row.Ip,
		CreatedAt:  row.CreatedAt,
	}
	if row.RevokedReason != nil {
		t.RevokedReason = *row.RevokedReason
	}
	return t
}
