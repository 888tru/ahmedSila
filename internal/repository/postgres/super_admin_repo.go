package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahmedsila/superadmin/internal/domain"
	"github.com/ahmedsila/superadmin/internal/repository/sqlc"
)

type SuperAdminRepo struct {
	q *sqlc.Queries
}

var _ domain.SuperAdminRepository = (*SuperAdminRepo)(nil)

func NewSuperAdminRepo(pool *pgxpool.Pool) *SuperAdminRepo {
	return &SuperAdminRepo{q: sqlc.New(pool)}
}

func (r *SuperAdminRepo) Create(ctx context.Context, u *domain.SuperAdminUser) error {
	row, err := r.q.CreateSuperAdmin(ctx, sqlc.CreateSuperAdminParams{
		Email:        u.Email,
		FullName:     u.FullName,
		PasswordHash: u.PasswordHash,
		Role:         sqlc.SuperAdminRole(u.Role),
		Status:       sqlc.SuperAdminStatus(u.Status),
	})
	if err != nil {
		return mapError(err)
	}
	// id и временные метки проставляет БД — возвращаем их вызывающему
	*u = *toDomainUser(row)
	return nil
}

func (r *SuperAdminRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.SuperAdminUser, error) {
	row, err := r.q.GetSuperAdminByID(ctx, id)
	if err != nil {
		return nil, mapError(err)
	}
	return toDomainUser(row), nil
}

func (r *SuperAdminRepo) GetByEmail(ctx context.Context, email string) (*domain.SuperAdminUser, error) {
	row, err := r.q.GetSuperAdminByEmail(ctx, email)
	if err != nil {
		return nil, mapError(err)
	}
	return toDomainUser(row), nil
}

func (r *SuperAdminRepo) List(ctx context.Context) ([]domain.SuperAdminUser, error) {
	rows, err := r.q.ListSuperAdmins(ctx)
	if err != nil {
		return nil, mapError(err)
	}
	out := make([]domain.SuperAdminUser, 0, len(rows))
	for _, row := range rows {
		out = append(out, *toDomainUser(row))
	}
	return out, nil
}

func (r *SuperAdminRepo) RegisterFailedLogin(ctx context.Context, id uuid.UUID, lockedUntil *time.Time) error {
	return mapError(r.q.RegisterFailedLogin(ctx, sqlc.RegisterFailedLoginParams{
		ID:          id,
		LockedUntil: lockedUntil,
	}))
}

func (r *SuperAdminRepo) RegisterSuccessfulLogin(ctx context.Context, id uuid.UUID, at time.Time) error {
	return mapError(r.q.RegisterSuccessfulLogin(ctx, sqlc.RegisterSuccessfulLoginParams{
		ID:          id,
		LastLoginAt: &at,
	}))
}

func (r *SuperAdminRepo) UpdateRole(ctx context.Context, id uuid.UUID, role domain.Role) (*domain.SuperAdminUser, error) {
	row, err := r.q.UpdateSuperAdminRole(ctx, sqlc.UpdateSuperAdminRoleParams{ID: id, Role: sqlc.SuperAdminRole(role)})
	if err != nil {
		return nil, mapError(err)
	}
	return toDomainUser(row), nil
}

func (r *SuperAdminRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status domain.UserStatus) (*domain.SuperAdminUser, error) {
	row, err := r.q.UpdateSuperAdminStatus(ctx, sqlc.UpdateSuperAdminStatusParams{ID: id, Status: sqlc.SuperAdminStatus(status)})
	if err != nil {
		return nil, mapError(err)
	}
	return toDomainUser(row), nil
}

func toDomainUser(row sqlc.SuperAdminUser) *domain.SuperAdminUser {
	return &domain.SuperAdminUser{
		ID:                  row.ID,
		Email:               row.Email,
		FullName:            row.FullName,
		PasswordHash:        row.PasswordHash,
		Role:                domain.Role(row.Role),
		Status:              domain.UserStatus(row.Status),
		TOTPSecret:          row.TotpSecret,
		TOTPEnrolledAt:      row.TotpEnrolledAt,
		FailedLoginAttempts: int(row.FailedLoginAttempts),
		LockedUntil:         row.LockedUntil,
		LastLoginAt:         row.LastLoginAt,
		CreatedAt:           row.CreatedAt,
		UpdatedAt:           row.UpdatedAt,
	}
}
