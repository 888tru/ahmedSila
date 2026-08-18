package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type TicketStatus string

const (
	TicketStatusOpen       TicketStatus = "open"
	TicketStatusInProgress TicketStatus = "in_progress"
	TicketStatusResolved   TicketStatus = "resolved"
	TicketStatusClosed     TicketStatus = "closed"
)

func (s TicketStatus) Valid() bool {
	switch s {
	case TicketStatusOpen, TicketStatusInProgress, TicketStatusResolved, TicketStatusClosed:
		return true
	default:
		return false
	}
}

type TicketPriority string

const (
	TicketPriorityLow    TicketPriority = "low"
	TicketPriorityNormal TicketPriority = "normal"
	TicketPriorityHigh   TicketPriority = "high"
)

func (p TicketPriority) Valid() bool {
	switch p {
	case TicketPriorityLow, TicketPriorityNormal, TicketPriorityHigh:
		return true
	default:
		return false
	}
}

// TicketMessageAuthor — клиент или кто-то из команды суперадминки.
// От клиента сообщения приходят с целевого сервиса (пока его нет — только
// сидом, см. cmd/seed); от команды — через Ticket.Reply.
type TicketMessageAuthor string

const (
	TicketMessageAuthorClient TicketMessageAuthor = "client"
	TicketMessageAuthorTeam   TicketMessageAuthor = "team"
)

type TicketMessage struct {
	ID         uuid.UUID
	TicketID   uuid.UUID
	Author     TicketMessageAuthor
	AuthorName string
	AuthorID   *uuid.UUID
	Body       string
	SentAt     time.Time
}

// Ticket — обращение клиента в поддержку. Messages заполняются только при
// получении одного обращения (GetByID) — списку они не нужны, а вес ответа
// на список был бы неоправданным.
type Ticket struct {
	ID            uuid.UUID
	TenantID      uuid.UUID
	Subject       string
	Status        TicketStatus
	Priority      TicketPriority
	AssigneeID    *uuid.UUID
	ContactName   string
	LastMessageAt time.Time
	CreatedAt     time.Time
	Messages      []TicketMessage
}

// TicketFilter — параметры выборки для общего экрана «Обращения» (PAGES.md §5)
// и вкладки «Обращения» в карточке клиента.
type TicketFilter struct {
	TenantID *uuid.UUID
	// "" — не фильтровать по статусу
	Status TicketStatus
	// Ровно один из двух: конкретный сотрудник или «без назначения».
	// Оба нулевые — не фильтровать по назначению вовсе.
	AssigneeID     *uuid.UUID
	OnlyUnassigned bool
}

type TicketRepository interface {
	List(ctx context.Context, f TicketFilter) ([]Ticket, error)
	// GetByID возвращает обращение вместе с перепиской.
	GetByID(ctx context.Context, id uuid.UUID) (*Ticket, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, status TicketStatus) (*Ticket, error)
	UpdatePriority(ctx context.Context, id uuid.UUID, priority TicketPriority) (*Ticket, error)
	AssignTo(ctx context.Context, id uuid.UUID, assigneeID *uuid.UUID) (*Ticket, error)
	AddMessage(ctx context.Context, m *TicketMessage) error
}
