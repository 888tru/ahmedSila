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
	users   userLister
}

func NewJournal(journal *usecase.Journal, users userLister) *Journal {
	return &Journal{journal: journal, users: users}
}

type journalEntryResponse struct {
	ID         int64     `json:"id"`
	OccurredAt time.Time `json:"occurred_at"`
	Actor      string    `json:"actor"`
	Kind       string    `json:"kind"`
	Text       string    `json:"text"`
	ClientID   *string   `json:"client_id"`
	ClientName *string   `json:"client_name"`
}

// toJournalEntryResponse принимает имена сотрудников готовыми (lookups),
// а не резолвит по одному: на список это N+1 запросов, а команда — десятки
// человек, дешевле поднять всех разом (см. buildLookups в ticket.go — тот же
// приём, только не exported оттуда, дублируется здесь на маленький объём).
func toJournalEntryResponse(e domain.AuditEntry, actorNames map[uuid.UUID]string) journalEntryResponse {
	actor := e.ActorEmail
	if e.ActorID != nil {
		if name, ok := actorNames[*e.ActorID]; ok && name != "" {
			actor = name
		}
	}

	out := journalEntryResponse{
		ID:         e.ID,
		OccurredAt: e.CreatedAt,
		Actor:      actor,
		Kind:       kindOf(e.Action),
		Text:       describeAction(e),
	}
	// tenant_name пишется в метаданные усечённым (см. Tenant.writeAudit,
	// Ticket.writeAudit) — так «Клиент» в журнале не требует join на каждую
	// строку и переживает удаление клиента, как actor_email переживает
	// удаление сотрудника.
	if e.TargetType == "tenant" && e.TargetID != "" {
		id := e.TargetID
		out.ClientID = &id
		if name := metaString(e.Metadata, "tenant_name"); name != "" {
			out.ClientName = &name
		}
	}
	return out
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

	users, err := h.users.List(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	actorNames := make(map[uuid.UUID]string, len(users))
	for _, u := range users {
		actorNames[u.ID] = u.FullName
	}

	out := make([]journalEntryResponse, 0, len(entries))
	for _, e := range entries {
		out = append(out, toJournalEntryResponse(e, actorNames))
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
