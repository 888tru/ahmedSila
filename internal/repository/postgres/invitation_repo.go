package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahmedsila/superadmin/internal/domain"
	"github.com/ahmedsila/superadmin/internal/repository/sqlc"
)

type InvitationRepo struct {
	q *sqlc.Queries
}

var _ domain.InvitationRepository = (*InvitationRepo)(nil)

func NewInvitationRepo(pool *pgxpool.Pool) *InvitationRepo {
	return &InvitationRepo{q: sqlc.New(pool)}
}

func (r *InvitationRepo) Create(ctx context.Context, inv *domain.Invitation) error {
	row, err := r.q.CreateInvitation(ctx, sqlc.CreateInvitationParams{
		Email:     inv.Email,
		Role:      sqlc.SuperAdminRole(inv.Role),
		TokenHash: inv.TokenHash,
		InvitedBy: inv.InvitedBy,
		ExpiresAt: inv.ExpiresAt,
	})
	if err != nil {
		return mapError(err)
	}
	inv.ID = row.ID
	inv.CreatedAt = row.CreatedAt
	return nil
}

func (r *InvitationRepo) HasPending(ctx context.Context, email string) (bool, error) {
	exists, err := r.q.HasPendingInvitation(ctx, email)
	if err != nil {
		return false, mapError(err)
	}
	return exists, nil
}
