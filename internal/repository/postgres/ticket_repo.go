package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahmedsila/superadmin/internal/domain"
	"github.com/ahmedsila/superadmin/internal/repository/sqlc"
)

type TicketRepo struct {
	q *sqlc.Queries
}

var _ domain.TicketRepository = (*TicketRepo)(nil)

func NewTicketRepo(pool *pgxpool.Pool) *TicketRepo {
	return &TicketRepo{q: sqlc.New(pool)}
}

func (r *TicketRepo) List(ctx context.Context, f domain.TicketFilter) ([]domain.Ticket, error) {
	var status *sqlc.TicketStatus
	if f.Status != "" {
		s := sqlc.TicketStatus(f.Status)
		status = &s
	}

	rows, err := r.q.ListTickets(ctx, sqlc.ListTicketsParams{TenantID: f.TenantID, Status: status})
	if err != nil {
		return nil, mapError(err)
	}

	out := make([]domain.Ticket, 0, len(rows))
	for _, row := range rows {
		if f.OnlyUnassigned && row.AssigneeID != nil {
			continue
		}
		if f.AssigneeID != nil && (row.AssigneeID == nil || *row.AssigneeID != *f.AssigneeID) {
			continue
		}
		out = append(out, *toDomainTicket(row))
	}
	return out, nil
}

func (r *TicketRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Ticket, error) {
	row, err := r.q.GetTicketByID(ctx, id)
	if err != nil {
		return nil, mapError(err)
	}
	ticket := toDomainTicket(row)

	messages, err := r.q.ListTicketMessages(ctx, id)
	if err != nil {
		return nil, mapError(err)
	}
	ticket.Messages = make([]domain.TicketMessage, 0, len(messages))
	for _, m := range messages {
		ticket.Messages = append(ticket.Messages, *toDomainTicketMessage(m))
	}
	return ticket, nil
}

func (r *TicketRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status domain.TicketStatus) (*domain.Ticket, error) {
	row, err := r.q.UpdateTicketStatus(ctx, sqlc.UpdateTicketStatusParams{ID: id, Status: sqlc.TicketStatus(status)})
	if err != nil {
		return nil, mapError(err)
	}
	return toDomainTicket(row), nil
}

func (r *TicketRepo) UpdatePriority(ctx context.Context, id uuid.UUID, priority domain.TicketPriority) (*domain.Ticket, error) {
	row, err := r.q.UpdateTicketPriority(ctx, sqlc.UpdateTicketPriorityParams{ID: id, Priority: sqlc.TicketPriority(priority)})
	if err != nil {
		return nil, mapError(err)
	}
	return toDomainTicket(row), nil
}

func (r *TicketRepo) AssignTo(ctx context.Context, id uuid.UUID, assigneeID *uuid.UUID) (*domain.Ticket, error) {
	row, err := r.q.AssignTicket(ctx, sqlc.AssignTicketParams{ID: id, AssigneeID: assigneeID})
	if err != nil {
		return nil, mapError(err)
	}
	return toDomainTicket(row), nil
}

func (r *TicketRepo) AddMessage(ctx context.Context, m *domain.TicketMessage) error {
	row, err := r.q.CreateTicketMessage(ctx, sqlc.CreateTicketMessageParams{
		TicketID:   m.TicketID,
		Author:     sqlc.TicketMessageAuthor(m.Author),
		AuthorName: m.AuthorName,
		AuthorID:   m.AuthorID,
		Body:       m.Body,
	})
	if err != nil {
		return mapError(err)
	}
	*m = *toDomainTicketMessage(row)
	return nil
}

func toDomainTicket(row sqlc.SupportTicket) *domain.Ticket {
	return &domain.Ticket{
		ID:            row.ID,
		TenantID:      row.TenantID,
		Subject:       row.Subject,
		Status:        domain.TicketStatus(row.Status),
		Priority:      domain.TicketPriority(row.Priority),
		AssigneeID:    row.AssigneeID,
		ContactName:   row.ContactName,
		LastMessageAt: row.LastMessageAt,
		CreatedAt:     row.CreatedAt,
	}
}

func toDomainTicketMessage(row sqlc.SupportTicketMessage) *domain.TicketMessage {
	return &domain.TicketMessage{
		ID:         row.ID,
		TicketID:   row.TicketID,
		Author:     domain.TicketMessageAuthor(row.Author),
		AuthorName: row.AuthorName,
		AuthorID:   row.AuthorID,
		Body:       row.Body,
		SentAt:     row.SentAt,
	}
}
