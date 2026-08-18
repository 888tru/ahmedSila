package usecase

import (
	"context"

	"github.com/ahmedsila/superadmin/internal/domain"
)

// Journal — тонкая обёртка над AuditRepository.List для общего экрана
// «Журнал действий» (PAGES.md §6). Отдельный usecase, а не вызов
// репозитория напрямую из хендлера: правило зависимостей одно для всех
// экранов, даже когда бизнес-логики за ним нет.
type Journal struct {
	audit domain.AuditRepository
}

func NewJournal(audit domain.AuditRepository) *Journal {
	return &Journal{audit: audit}
}

func (j *Journal) List(ctx context.Context, f domain.AuditFilter) ([]domain.AuditEntry, int64, error) {
	return j.audit.List(ctx, f)
}
