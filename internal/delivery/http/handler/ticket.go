package handler

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/ahmedsila/superadmin/internal/delivery/http/middleware"
	"github.com/ahmedsila/superadmin/internal/delivery/http/response"
	"github.com/ahmedsila/superadmin/internal/domain"
	"github.com/ahmedsila/superadmin/internal/usecase"
)

// userLister и tenantLister — узкие интерфейсы вместо полных портов: хендлеру
// нужно только разрешить id → имя (исполнитель, клиент), не всё остальное,
// что умеют domain.SuperAdminRepository и domain.TenantRepository.
type userLister interface {
	List(ctx context.Context) ([]domain.SuperAdminUser, error)
}

type tenantLister interface {
	List(ctx context.Context) ([]domain.Tenant, error)
}

type Ticket struct {
	tickets *usecase.Ticket
	users   userLister
	tenants tenantLister
}

func NewTicket(tickets *usecase.Ticket, users userLister, tenants tenantLister) *Ticket {
	return &Ticket{tickets: tickets, users: users, tenants: tenants}
}

type ticketMessageResponse struct {
	ID         string    `json:"id"`
	Author     string    `json:"author"`
	AuthorName string    `json:"author_name"`
	SentAt     time.Time `json:"sent_at"`
	Text       string    `json:"text"`
}

func toTicketMessageResponse(m domain.TicketMessage) ticketMessageResponse {
	return ticketMessageResponse{
		ID:         m.ID.String(),
		Author:     string(m.Author),
		AuthorName: m.AuthorName,
		SentAt:     m.SentAt,
		Text:       m.Body,
	}
}

// globalTicketResponse — строка общего списка «Обращения» (PAGES.md §5):
// клиент и его город денормализуются на лету из списка тенантов, а не
// в БД — тикетов немного, второй запрос дешевле, чем поддерживать копию.
type globalTicketResponse struct {
	ID            string    `json:"id"`
	ClientID      string    `json:"client_id"`
	ClientName    string    `json:"client_name"`
	City          string    `json:"city"`
	Subject       string    `json:"subject"`
	Status        string    `json:"status"`
	Priority      string    `json:"priority"`
	Assignee      *string   `json:"assignee"`
	ContactName   string    `json:"contact_name"`
	LastMessageAt time.Time `json:"last_message_at"`
}

type globalTicketDetailResponse struct {
	globalTicketResponse
	Messages []ticketMessageResponse `json:"messages"`
}

type clientTicketResponse struct {
	ID            string                  `json:"id"`
	ClientID      string                  `json:"client_id"`
	Subject       string                  `json:"subject"`
	Status        string                  `json:"status"`
	Assignee      *string                 `json:"assignee"`
	LastMessageAt time.Time               `json:"last_message_at"`
	Messages      []ticketMessageResponse `json:"messages"`
}

// lookups — id → имя для исполнителя и id → тенант для клиента, собранные
// один раз на запрос со списком, а не на каждую строку.
type lookups struct {
	users   map[uuid.UUID]string
	tenants map[uuid.UUID]domain.Tenant
}

func (h *Ticket) buildLookups(ctx context.Context) (lookups, error) {
	l := lookups{users: map[uuid.UUID]string{}, tenants: map[uuid.UUID]domain.Tenant{}}

	users, err := h.users.List(ctx)
	if err != nil {
		return l, err
	}
	for _, u := range users {
		l.users[u.ID] = u.FullName
	}

	tenants, err := h.tenants.List(ctx)
	if err != nil {
		return l, err
	}
	for _, t := range tenants {
		l.tenants[t.ID] = t
	}
	return l, nil
}

func (l lookups) assigneeName(id *uuid.UUID) *string {
	if id == nil {
		return nil
	}
	if name, ok := l.users[*id]; ok {
		return &name
	}
	return nil
}

func toGlobalTicketResponse(t domain.Ticket, l lookups) globalTicketResponse {
	tenant := l.tenants[t.TenantID]
	return globalTicketResponse{
		ID:            t.ID.String(),
		ClientID:      t.TenantID.String(),
		ClientName:    tenant.Name,
		City:          tenant.City,
		Subject:       t.Subject,
		Status:        string(t.Status),
		Priority:      string(t.Priority),
		Assignee:      l.assigneeName(t.AssigneeID),
		ContactName:   t.ContactName,
		LastMessageAt: t.LastMessageAt,
	}
}

func toClientTicketResponse(t domain.Ticket, l lookups) clientTicketResponse {
	messages := make([]ticketMessageResponse, 0, len(t.Messages))
	for _, m := range t.Messages {
		messages = append(messages, toTicketMessageResponse(m))
	}
	return clientTicketResponse{
		ID:            t.ID.String(),
		ClientID:      t.TenantID.String(),
		Subject:       t.Subject,
		Status:        string(t.Status),
		Assignee:      l.assigneeName(t.AssigneeID),
		LastMessageAt: t.LastMessageAt,
		Messages:      messages,
	}
}

// List — GET /api/v1/tickets
func (h *Ticket) List(c *gin.Context) {
	filter, err := parseTicketFilter(c)
	if err != nil {
		response.Error(c, err)
		return
	}

	tickets, err := h.tickets.List(c.Request.Context(), filter)
	if err != nil {
		response.Error(c, err)
		return
	}
	l, err := h.buildLookups(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}

	out := make([]globalTicketResponse, 0, len(tickets))
	for _, t := range tickets {
		out = append(out, toGlobalTicketResponse(t, l))
	}
	response.OK(c, out)
}

// ListByClient — GET /api/v1/clients/:id/tickets
func (h *Ticket) ListByClient(c *gin.Context) {
	tenantID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, domain.NewValidationError("id", "некорректный id клиента"))
		return
	}

	summaries, err := h.tickets.List(c.Request.Context(), domain.TicketFilter{TenantID: &tenantID})
	if err != nil {
		response.Error(c, err)
		return
	}
	l, err := h.buildLookups(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}

	// Вкладка карточки клиента показывает переписку сразу по всем его
	// обращениям без отдельного клика — их у одного клиента единицы,
	// подгрузить все треды здесь дешевле, чем городить лениво подгружаемый
	// список ради общего списка «Обращения» (см. globalTicketResponse выше).
	out := make([]clientTicketResponse, 0, len(summaries))
	for _, summary := range summaries {
		full, err := h.tickets.Get(c.Request.Context(), summary.ID)
		if err != nil {
			response.Error(c, err)
			return
		}
		out = append(out, toClientTicketResponse(*full, l))
	}
	response.OK(c, out)
}

// Get — GET /api/v1/tickets/:id
func (h *Ticket) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, domain.NewValidationError("id", "некорректный id обращения"))
		return
	}
	ticket, err := h.tickets.Get(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	l, err := h.buildLookups(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}

	messages := make([]ticketMessageResponse, 0, len(ticket.Messages))
	for _, m := range ticket.Messages {
		messages = append(messages, toTicketMessageResponse(m))
	}
	response.OK(c, globalTicketDetailResponse{
		globalTicketResponse: toGlobalTicketResponse(*ticket, l),
		Messages:             messages,
	})
}

type replyRequest struct {
	Text string `json:"text" binding:"required"`
}

// Reply — POST /api/v1/tickets/:id/messages
func (h *Ticket) Reply(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, domain.NewValidationError("id", "некорректный id обращения"))
		return
	}
	var req replyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, domain.NewValidationError("text", "текст ответа обязателен"))
		return
	}
	claims, ok := middleware.ClaimsFrom(c)
	if !ok {
		response.Error(c, domain.ErrUnauthenticated)
		return
	}

	message, err := h.tickets.Reply(c.Request.Context(), *claims, id, req.Text, requestContext(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, toTicketMessageResponse(*message))
}

// AssignToSelf — POST /api/v1/tickets/:id/assign
func (h *Ticket) AssignToSelf(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, domain.NewValidationError("id", "некорректный id обращения"))
		return
	}
	claims, ok := middleware.ClaimsFrom(c)
	if !ok {
		response.Error(c, domain.ErrUnauthenticated)
		return
	}

	ticket, err := h.tickets.AssignToSelf(c.Request.Context(), *claims, id, requestContext(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	l, err := h.buildLookups(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, toGlobalTicketResponse(*ticket, l))
}

type ticketStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

// UpdateStatus — POST /api/v1/tickets/:id/status
func (h *Ticket) UpdateStatus(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, domain.NewValidationError("id", "некорректный id обращения"))
		return
	}
	var req ticketStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, domain.NewValidationError("status", "статус обязателен"))
		return
	}
	claims, ok := middleware.ClaimsFrom(c)
	if !ok {
		response.Error(c, domain.ErrUnauthenticated)
		return
	}

	ticket, err := h.tickets.UpdateStatus(c.Request.Context(), *claims, id, domain.TicketStatus(req.Status), requestContext(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	l, err := h.buildLookups(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, toGlobalTicketResponse(*ticket, l))
}

type ticketPriorityRequest struct {
	Priority string `json:"priority" binding:"required"`
}

// UpdatePriority — POST /api/v1/tickets/:id/priority
func (h *Ticket) UpdatePriority(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, domain.NewValidationError("id", "некорректный id обращения"))
		return
	}
	var req ticketPriorityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, domain.NewValidationError("priority", "приоритет обязателен"))
		return
	}
	claims, ok := middleware.ClaimsFrom(c)
	if !ok {
		response.Error(c, domain.ErrUnauthenticated)
		return
	}

	ticket, err := h.tickets.UpdatePriority(c.Request.Context(), *claims, id, domain.TicketPriority(req.Priority), requestContext(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	l, err := h.buildLookups(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, toGlobalTicketResponse(*ticket, l))
}

func parseTicketFilter(c *gin.Context) (domain.TicketFilter, error) {
	f := domain.TicketFilter{Status: domain.TicketStatus(c.Query("status"))}
	if f.Status != "" && !f.Status.Valid() {
		return f, domain.NewValidationError("status", "недопустимый статус")
	}

	switch assignee := c.Query("assignee"); assignee {
	case "":
	case "unassigned":
		f.OnlyUnassigned = true
	default:
		id, err := uuid.Parse(assignee)
		if err != nil {
			return f, domain.NewValidationError("assignee", "некорректный id сотрудника")
		}
		f.AssigneeID = &id
	}

	if raw := c.Query("tenant_id"); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			return f, domain.NewValidationError("tenant_id", "некорректный id клиента")
		}
		f.TenantID = &id
	}

	return f, nil
}
