package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahmedsila/superadmin/internal/domain"
	"github.com/ahmedsila/superadmin/internal/repository/sqlc"
)

type TenantRepo struct {
	q *sqlc.Queries
}

var _ domain.TenantRepository = (*TenantRepo)(nil)

func NewTenantRepo(pool *pgxpool.Pool) *TenantRepo {
	return &TenantRepo{q: sqlc.New(pool)}
}

func (r *TenantRepo) Create(ctx context.Context, t *domain.Tenant) error {
	row, err := r.q.CreateTenant(ctx, sqlc.CreateTenantParams{
		Name:                    t.Name,
		City:                    t.City,
		Address:                 t.Address,
		Status:                  sqlc.TenantStatus(t.Status),
		Plan:                    sqlc.TenantPlan(t.Plan),
		OwnerName:               t.OwnerName,
		Phone:                   t.Phone,
		Email:                   t.Email,
		TrialEndsAt:             t.TrialEndsAt,
		ActivationCode:          t.ActivationCode,
		ActivationCodeExpiresAt: t.ActivationCodeExpiresAt,
	})
	if err != nil {
		return mapError(err)
	}
	*t = *toDomainTenant(row)
	return nil
}

func (r *TenantRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Tenant, error) {
	row, err := r.q.GetTenantByID(ctx, id)
	if err != nil {
		return nil, mapError(err)
	}
	return toDomainTenant(row), nil
}

func (r *TenantRepo) List(ctx context.Context) ([]domain.Tenant, error) {
	rows, err := r.q.ListTenants(ctx)
	if err != nil {
		return nil, mapError(err)
	}
	out := make([]domain.Tenant, 0, len(rows))
	for _, row := range rows {
		out = append(out, *toDomainTenant(row))
	}
	return out, nil
}

func (r *TenantRepo) IsEmailTaken(ctx context.Context, email string) (bool, error) {
	exists, err := r.q.IsTenantEmailTaken(ctx, email)
	if err != nil {
		return false, mapError(err)
	}
	return exists, nil
}

func (r *TenantRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status domain.TenantStatus, suspendedReason *string) (*domain.Tenant, error) {
	row, err := r.q.UpdateTenantStatus(ctx, sqlc.UpdateTenantStatusParams{
		ID:              id,
		Status:          sqlc.TenantStatus(status),
		SuspendedReason: suspendedReason,
	})
	if err != nil {
		return nil, mapError(err)
	}
	return toDomainTenant(row), nil
}

func (r *TenantRepo) SetActivationCode(ctx context.Context, id uuid.UUID, code string, expiresAt time.Time) (*domain.Tenant, error) {
	row, err := r.q.SetTenantActivationCode(ctx, sqlc.SetTenantActivationCodeParams{
		ID:                      id,
		ActivationCode:          &code,
		ActivationCodeExpiresAt: &expiresAt,
	})
	if err != nil {
		return nil, mapError(err)
	}
	return toDomainTenant(row), nil
}

func (r *TenantRepo) Delete(ctx context.Context, id uuid.UUID) error {
	return mapError(r.q.DeleteTenant(ctx, id))
}

func toDomainTenant(row sqlc.Tenant) *domain.Tenant {
	return &domain.Tenant{
		ID:                      row.ID,
		Name:                    row.Name,
		City:                    row.City,
		Address:                 row.Address,
		Status:                  domain.TenantStatus(row.Status),
		Plan:                    domain.TenantPlan(row.Plan),
		Employees:               int(row.Employees),
		OwnerName:               row.OwnerName,
		Phone:                   row.Phone,
		Email:                   row.Email,
		LastActiveAt:            row.LastActiveAt,
		TrialEndsAt:             row.TrialEndsAt,
		SuspendedReason:         row.SuspendedReason,
		ActivationCode:          row.ActivationCode,
		ActivationCodeExpiresAt: row.ActivationCodeExpiresAt,
		CreatedAt:               row.CreatedAt,
		UpdatedAt:               row.UpdatedAt,
	}
}
