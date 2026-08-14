package postgres

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"

	"github.com/ahmedsila/superadmin/internal/domain"
	"github.com/ahmedsila/superadmin/internal/repository/sqlc"
)

// AuditRepo пишет журнал действий.
//
// Логгер здесь не для отладки: usecase намеренно игнорирует ошибку записи
// аудита (журнал не должен ронять основную операцию), поэтому единственное
// место, где такая ошибка становится видимой, — здесь.
type AuditRepo struct {
	q   *sqlc.Queries
	log zerolog.Logger
}

var _ domain.AuditRepository = (*AuditRepo)(nil)

func NewAuditRepo(pool *pgxpool.Pool, log zerolog.Logger) *AuditRepo {
	return &AuditRepo{q: sqlc.New(pool), log: log}
}

func (r *AuditRepo) Write(ctx context.Context, e domain.AuditEntry) error {
	metadata := []byte("{}")
	if len(e.Metadata) > 0 {
		encoded, err := json.Marshal(e.Metadata)
		if err != nil {
			r.log.Error().Err(err).Str("action", e.Action).Msg("audit_metadata_marshal_failed")
		} else {
			metadata = encoded
		}
	}

	var createdAt *time.Time
	if !e.CreatedAt.IsZero() {
		createdAt = &e.CreatedAt
	}

	err := r.q.WriteAuditLog(ctx, sqlc.WriteAuditLogParams{
		ActorID:    e.ActorID,
		ActorEmail: e.ActorEmail,
		Action:     e.Action,
		TargetType: e.TargetType,
		TargetID:   e.TargetID,
		Metadata:   metadata,
		Ip:         e.IP,
		UserAgent:  e.UserAgent,
		CreatedAt:  createdAt,
	})
	if err != nil {
		err = mapError(err)
		r.log.Error().Err(err).Str("action", e.Action).Msg("audit_write_failed")
		return err
	}
	return nil
}

func (r *AuditRepo) List(ctx context.Context, f domain.AuditFilter) ([]domain.AuditEntry, int64, error) {
	limit := f.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	offset := f.Offset
	if offset < 0 {
		offset = 0
	}

	rows, err := r.q.ListAuditLogs(ctx, sqlc.ListAuditLogsParams{
		ActorID:      f.ActorID,
		Action:       nullableString(f.Action),
		TargetType:   nullableString(f.TargetType),
		TargetID:     nullableString(f.TargetID),
		FromTime:     f.From,
		ToTime:       f.To,
		ResultLimit:  int32(limit),
		ResultOffset: int32(offset),
	})
	if err != nil {
		return nil, 0, mapError(err)
	}

	total, err := r.q.CountAuditLogs(ctx, sqlc.CountAuditLogsParams{
		ActorID:    f.ActorID,
		Action:     nullableString(f.Action),
		TargetType: nullableString(f.TargetType),
		TargetID:   nullableString(f.TargetID),
		FromTime:   f.From,
		ToTime:     f.To,
	})
	if err != nil {
		return nil, 0, mapError(err)
	}

	out := make([]domain.AuditEntry, 0, len(rows))
	for _, row := range rows {
		entry := domain.AuditEntry{
			ID:         row.ID,
			ActorID:    row.ActorID,
			ActorEmail: row.ActorEmail,
			Action:     row.Action,
			TargetType: row.TargetType,
			TargetID:   row.TargetID,
			IP:         row.Ip,
			UserAgent:  row.UserAgent,
			CreatedAt:  row.CreatedAt,
		}
		if len(row.Metadata) > 0 {
			if err := json.Unmarshal(row.Metadata, &entry.Metadata); err != nil {
				r.log.Warn().Err(err).Int64("audit_id", row.ID).Msg("audit_metadata_unmarshal_failed")
			}
		}
		out = append(out, entry)
	}

	return out, total, nil
}

// nullableString: пустой фильтр означает «не фильтровать» (NULL для sqlc.narg).
func nullableString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
