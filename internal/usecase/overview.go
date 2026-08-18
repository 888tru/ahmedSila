package usecase

import (
	"context"
	"sort"

	"github.com/ahmedsila/superadmin/internal/domain"
)

const (
	overviewPeriodDays = 7
	trialHorizonDays   = 14
	trialsShown        = 5
	recentEventsShown  = 7
)

type OverviewMetrics struct {
	ActiveClients int
	TrialClients  int
	OpenTickets   int
	PausedClients int
}

// OverviewData — сырые данные для «Обзора» (PAGES.md §1). Дельты к периоду
// намеренно не считаются: это требует исторических снимков метрик
// (`tenant_metrics_snapshots` из TECH_STACK.md, фоновая задача по расписанию),
// которых нет в MVP — фронт уже умеет показывать метрику без дельты
// (`delta: null`), поэтому здесь просто нечего проставлять.
type OverviewData struct {
	PeriodDays     int
	TotalClients   int
	Metrics        OverviewMetrics
	ExpiringTrials []domain.Tenant
	Events         []domain.AuditEntry
}

type Overview struct {
	tenants domain.TenantRepository
	tickets domain.TicketRepository
	audit   domain.AuditRepository
	clock   domain.Clock
}

func NewOverview(tenants domain.TenantRepository, tickets domain.TicketRepository, audit domain.AuditRepository, clock domain.Clock) *Overview {
	return &Overview{tenants: tenants, tickets: tickets, audit: audit, clock: clock}
}

func (o *Overview) Get(ctx context.Context) (*OverviewData, error) {
	tenants, err := o.tenants.List(ctx)
	if err != nil {
		return nil, err
	}

	tickets, err := o.tickets.List(ctx, domain.TicketFilter{})
	if err != nil {
		return nil, err
	}

	metrics := OverviewMetrics{}
	for _, tenant := range tenants {
		switch tenant.Status {
		case domain.TenantStatusActive:
			metrics.ActiveClients++
		case domain.TenantStatusTrial:
			metrics.TrialClients++
		case domain.TenantStatusPaused:
			metrics.PausedClients++
		}
	}
	for _, ticket := range tickets {
		if ticket.Status == domain.TicketStatusOpen || ticket.Status == domain.TicketStatusInProgress {
			metrics.OpenTickets++
		}
	}

	now := o.clock.Now()
	horizon := now.AddDate(0, 0, trialHorizonDays)
	expiring := make([]domain.Tenant, 0)
	for _, tenant := range tenants {
		if tenant.Status == domain.TenantStatusTrial && tenant.TrialEndsAt != nil && !tenant.TrialEndsAt.After(horizon) {
			expiring = append(expiring, tenant)
		}
	}
	sort.Slice(expiring, func(i, j int) bool {
		return expiring[i].TrialEndsAt.Before(*expiring[j].TrialEndsAt)
	})
	if len(expiring) > trialsShown {
		expiring = expiring[:trialsShown]
	}

	events, _, err := o.audit.List(ctx, domain.AuditFilter{Limit: recentEventsShown})
	if err != nil {
		return nil, err
	}

	return &OverviewData{
		PeriodDays:     overviewPeriodDays,
		TotalClients:   len(tenants),
		Metrics:        metrics,
		ExpiringTrials: expiring,
		Events:         events,
	}, nil
}
