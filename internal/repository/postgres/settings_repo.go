package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahmedsila/superadmin/internal/domain"
	"github.com/ahmedsila/superadmin/internal/repository/sqlc"
)

type MessageTemplateRepo struct {
	q *sqlc.Queries
}

var _ domain.MessageTemplateRepository = (*MessageTemplateRepo)(nil)

func NewMessageTemplateRepo(pool *pgxpool.Pool) *MessageTemplateRepo {
	return &MessageTemplateRepo{q: sqlc.New(pool)}
}

func (r *MessageTemplateRepo) Get(ctx context.Context, key string) (*domain.MessageTemplate, error) {
	row, err := r.q.GetMessageTemplate(ctx, key)
	if err != nil {
		return nil, mapError(err)
	}
	return toDomainTemplate(row), nil
}

func (r *MessageTemplateRepo) Update(ctx context.Context, key, body string, updatedBy uuid.UUID, at time.Time) (*domain.MessageTemplate, error) {
	row, err := r.q.UpdateMessageTemplate(ctx, sqlc.UpdateMessageTemplateParams{
		Key:       key,
		Body:      body,
		UpdatedAt: &at,
		UpdatedBy: &updatedBy,
	})
	if err != nil {
		return nil, mapError(err)
	}
	return toDomainTemplate(row), nil
}

func toDomainTemplate(row sqlc.MessageTemplate) *domain.MessageTemplate {
	return &domain.MessageTemplate{
		Key:       row.Key,
		Body:      row.Body,
		UpdatedAt: row.UpdatedAt,
		UpdatedBy: row.UpdatedBy,
	}
}
