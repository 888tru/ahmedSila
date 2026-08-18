package handler

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/ahmedsila/superadmin/internal/delivery/http/response"
	"github.com/ahmedsila/superadmin/internal/domain"
	"github.com/ahmedsila/superadmin/internal/usecase"
)

type Journal struct {
	journal *usecase.Journal
}

func NewJournal(journal *usecase.Journal) *Journal {
	return &Journal{journal: journal}
}

type journalEntryResponse struct {
	ID         int64     `json:"id"`
	OccurredAt time.Time `json:"occurred_at"`
	Actor      string    `json:"actor"`
	Action     string    `json:"action"`
	// Kind — категория действия для чипов-фильтров интерфейса (PAGES.md §6):
	// «Доступ»/«Клиенты»/«Подписка»/«Обращения»/«Команда». Производная от
	// Action, а не отдельное поле в БД — иначе пришлось бы держать их в
	// синхроне вручную при каждой новой доменной операции.
	Kind       string         `json:"kind"`
	TargetType string         `json:"target_type"`
	TargetID   string         `json:"target_id"`
	Metadata   map[string]any `json:"metadata,omitempty"`
}

// actionKind — карта известных действий на категорию экрана. Новое действие
// без записи здесь попадает в «team» по умолчанию (см. kindOf) — заметно
// в интерфейсе, что запись не расклассифицирована, и это повод дописать карту,
// а не молча потерять фильтрацию.
var actionKind = map[string]string{
	domain.AuditLoginSuccess:            "access",
	domain.AuditLoginFailure:            "access",
	domain.AuditLogout:                  "access",
	domain.AuditTokenRefresh:            "access",
	domain.AuditTokenReuse:              "access",
	domain.AuditSessionsRevoked:         "access",
	domain.AuditTenantCreated:           "clients",
	domain.AuditTenantUpdated:           "clients",
	domain.AuditTenantSuspended:         "access",
	domain.AuditTenantResumed:           "access",
	domain.AuditSuperAdminCreate:        "team",
	domain.AuditSuperAdminInvited:       "team",
	domain.AuditSuperAdminRoleChanged:   "team",
	domain.AuditSuperAdminAccessRevoked: "team",
	domain.AuditMessageTemplateUpdated:  "team",
}

func kindOf(action string) string {
	if kind, ok := actionKind[action]; ok {
		return kind
	}
	return "team"
}

func toJournalEntryResponse(e domain.AuditEntry) journalEntryResponse {
	return journalEntryResponse{
		ID:         e.ID,
		OccurredAt: e.CreatedAt,
		Actor:      e.ActorEmail,
		Action:     e.Action,
		Kind:       kindOf(e.Action),
		TargetType: e.TargetType,
		TargetID:   e.TargetID,
		Metadata:   e.Metadata,
	}
}

// List — GET /api/v1/journal
func (h *Journal) List(c *gin.Context) {
	filter, err := parseAuditFilter(c)
	if err != nil {
		response.Error(c, err)
		return
	}

	entries, total, err := h.journal.List(c.Request.Context(), filter)
	if err != nil {
		response.Error(c, err)
		return
	}

	out := make([]journalEntryResponse, 0, len(entries))
	for _, e := range entries {
		out = append(out, toJournalEntryResponse(e))
	}
	response.List(c, out, response.Meta{Total: total, Limit: filter.Limit, Offset: filter.Offset})
}

func parseAuditFilter(c *gin.Context) (domain.AuditFilter, error) {
	f := domain.AuditFilter{
		Action:     c.Query("action"),
		TargetType: c.Query("target_type"),
		TargetID:   c.Query("target_id"),
		Limit:      50,
	}

	if raw := c.Query("actor_id"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			return f, domain.NewValidationError("actor_id", "некорректный id сотрудника")
		}
		f.ActorID = &id
	}

	if raw := c.Query("from"); raw != "" {
		t, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return f, domain.NewValidationError("from", "ожидается дата в формате RFC3339")
		}
		f.From = &t
	}
	if raw := c.Query("to"); raw != "" {
		t, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return f, domain.NewValidationError("to", "ожидается дата в формате RFC3339")
		}
		f.To = &t
	}

	if raw := c.Query("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n <= 0 {
			return f, domain.NewValidationError("limit", "должно быть положительным числом")
		}
		f.Limit = n
	}
	if raw := c.Query("offset"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 0 {
			return f, domain.NewValidationError("offset", "должно быть неотрицательным числом")
		}
		f.Offset = n
	}

	return f, nil
}
