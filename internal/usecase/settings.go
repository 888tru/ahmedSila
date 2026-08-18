package usecase

import (
	"context"

	"github.com/ahmedsila/superadmin/internal/domain"
)

// plans — справочные тарифы (см. domain.PlanInfo: почему в коде, а не в БД).
var plans = []domain.PlanInfo{
	{Plan: "Starter", Limit: "до 15", Price: "24 000", Includes: "Базовые задачи и смены, до 15 сотрудников, поддержка по email"},
	{Plan: "Growth", Limit: "до 60", Price: "58 000", Includes: "Задачи и смены, заявки на закупку, приоритетная поддержка"},
	{Plan: "Enterprise", Limit: "без лимита", Price: "по договору", Includes: "Без ограничения по сотрудникам, отдельный менеджер, индивидуальные условия"},
}

type Settings struct {
	templates domain.MessageTemplateRepository
	audit     domain.AuditRepository
	clock     domain.Clock
}

func NewSettings(templates domain.MessageTemplateRepository, audit domain.AuditRepository, clock domain.Clock) *Settings {
	return &Settings{templates: templates, audit: audit, clock: clock}
}

func (s *Settings) Plans() []domain.PlanInfo {
	return plans
}

func (s *Settings) Template(ctx context.Context) (*domain.MessageTemplate, error) {
	return s.templates.Get(ctx, domain.MessageTemplateKey)
}

func (s *Settings) SaveTemplate(ctx context.Context, actor domain.AccessClaims, body string, rc domain.RequestContext) (*domain.MessageTemplate, error) {
	now := s.clock.Now()
	tpl, err := s.templates.Update(ctx, domain.MessageTemplateKey, body, actor.UserID, now)
	if err != nil {
		return nil, err
	}

	_ = s.audit.Write(ctx, domain.AuditEntry{
		ActorID:    &actor.UserID,
		ActorEmail: actor.Email,
		Action:     domain.AuditMessageTemplateUpdated,
		TargetType: string(domain.ResourceSettings),
		TargetID:   domain.MessageTemplateKey,
		IP:         rc.IP,
		UserAgent:  rc.UserAgent,
		CreatedAt:  now,
	})

	return tpl, nil
}
