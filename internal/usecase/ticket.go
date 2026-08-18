package usecase

import (
	"context"

	"github.com/google/uuid"

	"github.com/ahmedsila/superadmin/internal/domain"
)

type Ticket struct {
	tickets domain.TicketRepository
	tenants domain.TenantRepository
	users   domain.SuperAdminRepository
	audit   domain.AuditRepository
	clock   domain.Clock
}

func NewTicket(tickets domain.TicketRepository, tenants domain.TenantRepository, users domain.SuperAdminRepository, audit domain.AuditRepository, clock domain.Clock) *Ticket {
	return &Ticket{tickets: tickets, tenants: tenants, users: users, audit: audit, clock: clock}
}

func (t *Ticket) List(ctx context.Context, f domain.TicketFilter) ([]domain.Ticket, error) {
	return t.tickets.List(ctx, f)
}

func (t *Ticket) Get(ctx context.Context, id uuid.UUID) (*domain.Ticket, error) {
	return t.tickets.GetByID(ctx, id)
}

// Reply отправляет ответ от имени команды — сообщения от клиента приходят
// с целевого сервиса (см. domain/ticket.go), этот путь их не создаёт.
func (t *Ticket) Reply(ctx context.Context, actor domain.AccessClaims, ticketID uuid.UUID, body string, rc domain.RequestContext) (*domain.TicketMessage, error) {
	if body == "" {
		return nil, domain.NewValidationError("text", "текст ответа обязателен")
	}

	ticket, err := t.tickets.GetByID(ctx, ticketID)
	if err != nil {
		return nil, err
	}

	// Имя, а не email: тред читает клиент, и в остальной переписке команда
	// подписывается именем (см. author_name у сидовых сообщений).
	authorName := actor.Email
	if user, err := t.users.GetByID(ctx, actor.UserID); err == nil {
		authorName = user.FullName
	}

	message := &domain.TicketMessage{
		TicketID:   ticketID,
		Author:     domain.TicketMessageAuthorTeam,
		AuthorName: authorName,
		AuthorID:   &actor.UserID,
		Body:       body,
	}
	if err := t.tickets.AddMessage(ctx, message); err != nil {
		return nil, err
	}

	t.writeAudit(ctx, actor, domain.AuditTicketReplied, ticket, rc, nil)
	return message, nil
}

func (t *Ticket) AssignToSelf(ctx context.Context, actor domain.AccessClaims, ticketID uuid.UUID, rc domain.RequestContext) (*domain.Ticket, error) {
	ticket, err := t.tickets.AssignTo(ctx, ticketID, &actor.UserID)
	if err != nil {
		return nil, err
	}
	t.writeAudit(ctx, actor, domain.AuditTicketAssigned, ticket, rc, nil)
	return ticket, nil
}

func (t *Ticket) UpdateStatus(ctx context.Context, actor domain.AccessClaims, ticketID uuid.UUID, status domain.TicketStatus, rc domain.RequestContext) (*domain.Ticket, error) {
	if !status.Valid() {
		return nil, domain.NewValidationError("status", "недопустимый статус")
	}
	ticket, err := t.tickets.UpdateStatus(ctx, ticketID, status)
	if err != nil {
		return nil, err
	}
	t.writeAudit(ctx, actor, domain.AuditTicketStatusChanged, ticket, rc, map[string]any{"status": string(status)})
	return ticket, nil
}

func (t *Ticket) UpdatePriority(ctx context.Context, actor domain.AccessClaims, ticketID uuid.UUID, priority domain.TicketPriority, rc domain.RequestContext) (*domain.Ticket, error) {
	if !priority.Valid() {
		return nil, domain.NewValidationError("priority", "недопустимый приоритет")
	}
	ticket, err := t.tickets.UpdatePriority(ctx, ticketID, priority)
	if err != nil {
		return nil, err
	}
	t.writeAudit(ctx, actor, domain.AuditTicketPriorityChanged, ticket, rc, map[string]any{"priority": string(priority)})
	return ticket, nil
}

func (t *Ticket) writeAudit(ctx context.Context, actor domain.AccessClaims, action string, ticket *domain.Ticket, rc domain.RequestContext, extra map[string]any) {
	metadata := map[string]any{"subject": ticket.Subject}
	for k, v := range extra {
		metadata[k] = v
	}
	if tenant, err := t.tenants.GetByID(ctx, ticket.TenantID); err == nil {
		metadata["tenant_name"] = tenant.Name
	}
	_ = t.audit.Write(ctx, domain.AuditEntry{
		ActorID:    &actor.UserID,
		ActorEmail: actor.Email,
		Action:     action,
		TargetType: "tenant",
		TargetID:   ticket.TenantID.String(),
		Metadata:   metadata,
		IP:         rc.IP,
		UserAgent:  rc.UserAgent,
		CreatedAt:  t.clock.Now(),
	})
}
