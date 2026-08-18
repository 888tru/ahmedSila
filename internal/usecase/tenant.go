package usecase

import (
	"context"
	"crypto/rand"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/ahmedsila/superadmin/internal/domain"
)

// activationCodeTTL — семь дней, тот же срок, что у приглашения в команду:
// один и тот же продукт диктует одно число, а не два похожих.
const activationCodeTTL = 7 * 24 * time.Hour

type Tenant struct {
	tenants domain.TenantRepository
	audit   domain.AuditRepository
	clock   domain.Clock
}

func NewTenant(tenants domain.TenantRepository, audit domain.AuditRepository, clock domain.Clock) *Tenant {
	return &Tenant{tenants: tenants, audit: audit, clock: clock}
}

func (t *Tenant) List(ctx context.Context) ([]domain.Tenant, error) {
	return t.tenants.List(ctx)
}

func (t *Tenant) Get(ctx context.Context, id uuid.UUID) (*domain.Tenant, error) {
	return t.tenants.GetByID(ctx, id)
}

func (t *Tenant) IsEmailTaken(ctx context.Context, email string) (bool, error) {
	return t.tenants.IsEmailTaken(ctx, email)
}

// Create заводит клиента и сразу выдаёт код подтверждения для первого входа
// владельца — карточка после создания показывает его без отдельного запроса
// (см. NewClientPage на фронте).
func (t *Tenant) Create(ctx context.Context, actor domain.AccessClaims, in domain.NewTenant, rc domain.RequestContext) (*domain.Tenant, error) {
	if !in.Plan.Valid() {
		return nil, domain.NewValidationError("plan", "недопустимый тариф")
	}

	now := t.clock.Now()
	status := domain.TenantStatusActive
	var trialEndsAt *time.Time
	if in.TrialDays > 0 {
		status = domain.TenantStatusTrial
		exp := now.Add(time.Duration(in.TrialDays) * 24 * time.Hour)
		trialEndsAt = &exp
	}

	code, err := generateActivationCode()
	if err != nil {
		return nil, err
	}
	codeExpiresAt := now.Add(activationCodeTTL)

	tenant := &domain.Tenant{
		Name:                    in.Name,
		City:                    in.City,
		Address:                 in.Address,
		Status:                  status,
		Plan:                    in.Plan,
		OwnerName:               in.OwnerName,
		Phone:                   in.Phone,
		Email:                   in.Email,
		TrialEndsAt:             trialEndsAt,
		ActivationCode:          &code,
		ActivationCodeExpiresAt: &codeExpiresAt,
	}
	if err := t.tenants.Create(ctx, tenant); err != nil {
		return nil, err
	}

	t.writeAudit(ctx, actor, domain.AuditTenantCreated, tenant, rc, map[string]any{"plan": string(in.Plan)})
	return tenant, nil
}

func (t *Tenant) Suspend(ctx context.Context, actor domain.AccessClaims, id uuid.UUID, reason string, rc domain.RequestContext) (*domain.Tenant, error) {
	if reason == "" {
		return nil, domain.NewValidationError("reason", "причина обязательна")
	}
	tenant, err := t.tenants.UpdateStatus(ctx, id, domain.TenantStatusPaused, &reason)
	if err != nil {
		return nil, err
	}
	t.writeAudit(ctx, actor, domain.AuditTenantSuspended, tenant, rc, map[string]any{"reason": reason})
	return tenant, nil
}

func (t *Tenant) Resume(ctx context.Context, actor domain.AccessClaims, id uuid.UUID, rc domain.RequestContext) (*domain.Tenant, error) {
	tenant, err := t.tenants.UpdateStatus(ctx, id, domain.TenantStatusActive, nil)
	if err != nil {
		return nil, err
	}
	t.writeAudit(ctx, actor, domain.AuditTenantResumed, tenant, rc, nil)
	return tenant, nil
}

func (t *Tenant) IssueActivationCode(ctx context.Context, actor domain.AccessClaims, id uuid.UUID, rc domain.RequestContext) (*domain.Tenant, error) {
	code, err := generateActivationCode()
	if err != nil {
		return nil, err
	}
	now := t.clock.Now()
	tenant, err := t.tenants.SetActivationCode(ctx, id, code, now.Add(activationCodeTTL))
	if err != nil {
		return nil, err
	}
	t.writeAudit(ctx, actor, domain.AuditTenantActivationCodeIssued, tenant, rc, nil)
	return tenant, nil
}

func (t *Tenant) Delete(ctx context.Context, actor domain.AccessClaims, id uuid.UUID, rc domain.RequestContext) error {
	tenant, err := t.tenants.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if err := t.tenants.Delete(ctx, id); err != nil {
		return err
	}
	t.writeAudit(ctx, actor, domain.AuditTenantDeleted, tenant, rc, nil)
	return nil
}

func (t *Tenant) writeAudit(ctx context.Context, actor domain.AccessClaims, action string, tenant *domain.Tenant, rc domain.RequestContext, extra map[string]any) {
	metadata := map[string]any{"tenant_name": tenant.Name}
	for k, v := range extra {
		metadata[k] = v
	}
	_ = t.audit.Write(ctx, domain.AuditEntry{
		ActorID:    &actor.UserID,
		ActorEmail: actor.Email,
		Action:     action,
		TargetType: "tenant",
		TargetID:   tenant.ID.String(),
		Metadata:   metadata,
		IP:         rc.IP,
		UserAgent:  rc.UserAgent,
		CreatedAt:  t.clock.Now(),
	})
}

// generateActivationCode — «XXXX-XXXX» без похожих друг на друга 0/O и 1/I:
// код диктуют по телефону (см. randomCode() в клиентском моке — тот же приём).
func generateActivationCode() (string, error) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	group, err := randomAlphabetString(alphabet, 4)
	if err != nil {
		return "", err
	}
	group2, err := randomAlphabetString(alphabet, 4)
	if err != nil {
		return "", err
	}
	return group + "-" + group2, nil
}

func randomAlphabetString(alphabet string, n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("генерация кода: %w", err)
	}
	out := make([]byte, n)
	for i, v := range b {
		out[i] = alphabet[int(v)%len(alphabet)]
	}
	return string(out), nil
}
