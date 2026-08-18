package handler

import (
	"time"

	"github.com/gin-gonic/gin"

	"github.com/ahmedsila/superadmin/internal/delivery/http/response"
	"github.com/ahmedsila/superadmin/internal/domain"
	"github.com/ahmedsila/superadmin/internal/usecase"
)

type Overview struct {
	overview *usecase.Overview
}

func NewOverview(overview *usecase.Overview) *Overview {
	return &Overview{overview: overview}
}

type overviewMetricResponse struct {
	Key   string `json:"key"`
	Value int    `json:"value"`
	// Дельта к предыдущему периоду всегда null: она требует исторических
	// снимков метрик (`tenant_metrics_snapshots`), которых нет в MVP —
	// см. usecase.OverviewData.
	Delta *int `json:"delta"`
}

type expiringTrialResponse struct {
	ClientID string    `json:"client_id"`
	Name     string    `json:"name"`
	EndsAt   time.Time `json:"ends_at"`
}

type overviewEventResponse struct {
	ID         int64     `json:"id"`
	OccurredAt time.Time `json:"occurred_at"`
	Kind       string    `json:"kind"`
	Text       string    `json:"text"`
}

type overviewResponse struct {
	PeriodDays     int                      `json:"period_days"`
	TotalClients   int                      `json:"total_clients"`
	Metrics        []overviewMetricResponse `json:"metrics"`
	ExpiringTrials []expiringTrialResponse  `json:"expiring_trials"`
	Events         []overviewEventResponse  `json:"events"`
}

// overviewEventKind — своя, более грубая категоризация, чем kindOf для
// «Журнала» (PAGES.md §1 показывает только цвет точки, не текстовый фильтр,
// поэтому пяти категорий журнала здесь ни к чему).
func overviewEventKind(action string) string {
	switch action {
	case domain.AuditTenantCreated:
		return "client_created"
	case domain.AuditTenantSuspended:
		return "access_paused"
	case domain.AuditTenantResumed:
		return "client_activated"
	case domain.AuditTicketReplied, domain.AuditTicketAssigned, domain.AuditTicketStatusChanged, domain.AuditTicketPriorityChanged:
		return "ticket_opened"
	default:
		return "other"
	}
}

// Get — GET /api/v1/overview
func (h *Overview) Get(c *gin.Context) {
	data, err := h.overview.Get(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}

	metrics := []overviewMetricResponse{
		{Key: "activeClients", Value: data.Metrics.ActiveClients},
		{Key: "trialClients", Value: data.Metrics.TrialClients},
		{Key: "openTickets", Value: data.Metrics.OpenTickets},
		{Key: "pausedClients", Value: data.Metrics.PausedClients},
	}

	trials := make([]expiringTrialResponse, 0, len(data.ExpiringTrials))
	for _, tenant := range data.ExpiringTrials {
		trials = append(trials, expiringTrialResponse{
			ClientID: tenant.ID.String(),
			Name:     tenant.Name,
			EndsAt:   *tenant.TrialEndsAt,
		})
	}

	events := make([]overviewEventResponse, 0, len(data.Events))
	for _, e := range data.Events {
		events = append(events, overviewEventResponse{
			ID:         e.ID,
			OccurredAt: e.CreatedAt,
			Kind:       overviewEventKind(e.Action),
			Text:       describeAction(e),
		})
	}

	response.OK(c, overviewResponse{
		PeriodDays:     data.PeriodDays,
		TotalClients:   data.TotalClients,
		Metrics:        metrics,
		ExpiringTrials: trials,
		Events:         events,
	})
}
