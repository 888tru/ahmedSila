package handler

import (
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/ahmedsila/superadmin/internal/delivery/http/middleware"
	"github.com/ahmedsila/superadmin/internal/delivery/http/response"
	"github.com/ahmedsila/superadmin/internal/domain"
	"github.com/ahmedsila/superadmin/internal/usecase"
)

type Tenant struct {
	tenants *usecase.Tenant
	journal *usecase.Journal
	tickets *usecase.Ticket
}

func NewTenant(tenants *usecase.Tenant, journal *usecase.Journal, tickets *usecase.Ticket) *Tenant {
	return &Tenant{tenants: tenants, journal: journal, tickets: tickets}
}

type tenantResponse struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	City         string     `json:"city"`
	Status       string     `json:"status"`
	Plan         string     `json:"plan"`
	Employees    int        `json:"employees"`
	LastActiveAt *time.Time `json:"last_active_at"`
	CreatedAt    time.Time  `json:"created_at"`
	TrialEndsAt  *time.Time `json:"trial_ends_at"`
}

type tenantDetailResponse struct {
	tenantResponse
	Address         string                  `json:"address"`
	OwnerName       string                  `json:"owner_name"`
	Phone           string                  `json:"phone"`
	Email           string                  `json:"email"`
	OpenTickets     int                     `json:"open_tickets"`
	SuspendedReason *string                 `json:"suspended_reason"`
	ActivationCode  *activationCodeResponse `json:"activation_code"`
}

type activationCodeResponse struct {
	Code      string    `json:"code"`
	ExpiresAt time.Time `json:"expires_at"`
}

func toTenantResponse(t domain.Tenant) tenantResponse {
	return tenantResponse{
		ID:           t.ID.String(),
		Name:         t.Name,
		City:         t.City,
		Status:       string(t.Status),
		Plan:         string(t.Plan),
		Employees:    t.Employees,
		LastActiveAt: t.LastActiveAt,
		CreatedAt:    t.CreatedAt,
		TrialEndsAt:  t.TrialEndsAt,
	}
}

func (h *Tenant) toTenantDetailResponse(ctx *gin.Context, t domain.Tenant) tenantDetailResponse {
	openTickets, err := h.tickets.List(ctx.Request.Context(), domain.TicketFilter{TenantID: &t.ID})
	openCount := 0
	if err == nil {
		for _, tk := range openTickets {
			if tk.Status == domain.TicketStatusOpen || tk.Status == domain.TicketStatusInProgress {
				openCount++
			}
		}
	}

	out := tenantDetailResponse{
		tenantResponse:  toTenantResponse(t),
		Address:         t.Address,
		OwnerName:       t.OwnerName,
		Phone:           t.Phone,
		Email:           t.Email,
		OpenTickets:     openCount,
		SuspendedReason: t.SuspendedReason,
	}
	if t.ActivationCode != nil && t.ActivationCodeExpiresAt != nil {
		out.ActivationCode = &activationCodeResponse{Code: *t.ActivationCode, ExpiresAt: *t.ActivationCodeExpiresAt}
	}
	return out
}

// List — GET /api/v1/clients
func (h *Tenant) List(c *gin.Context) {
	tenants, err := h.tenants.List(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	out := make([]tenantResponse, 0, len(tenants))
	for _, t := range tenants {
		out = append(out, toTenantResponse(t))
	}
	response.OK(c, out)
}

// Get — GET /api/v1/clients/:id
func (h *Tenant) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, domain.NewValidationError("id", "некорректный id клиента"))
		return
	}
	tenant, err := h.tenants.Get(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, h.toTenantDetailResponse(c, *tenant))
}

// EmailTaken — GET /api/v1/clients/email-taken?email=...
func (h *Tenant) EmailTaken(c *gin.Context) {
	email := c.Query("email")
	if email == "" {
		response.Error(c, domain.NewValidationError("email", "укажите email"))
		return
	}
	taken, err := h.tenants.IsEmailTaken(c.Request.Context(), email)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, gin.H{"taken": taken})
}

type newTenantRequest struct {
	Name      string `json:"name" binding:"required,max=255"`
	Address   string `json:"address" binding:"required,max=500"`
	OwnerName string `json:"owner_name" binding:"required,max=255"`
	Phone     string `json:"phone" binding:"required,max=64"`
	Email     string `json:"email" binding:"required,email,max=255"`
	Plan      string `json:"plan" binding:"required"`
	TrialDays int    `json:"trial_days"`
}

// Create — POST /api/v1/clients
func (h *Tenant) Create(c *gin.Context) {
	var req newTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, domain.NewValidationError("body", "заполните обязательные поля"))
		return
	}

	claims, ok := middleware.ClaimsFrom(c)
	if !ok {
		response.Error(c, domain.ErrUnauthenticated)
		return
	}

	// Город — то, что стоит до первой запятой в адресе: форма принимает адрес
	// одной строкой, как её диктует клиент по телефону (см. NewClient на фронте)
	city, _, _ := strings.Cut(req.Address, ",")

	tenant, err := h.tenants.Create(c.Request.Context(), *claims, domain.NewTenant{
		Name:      req.Name,
		City:      strings.TrimSpace(city),
		Address:   req.Address,
		OwnerName: req.OwnerName,
		Phone:     req.Phone,
		Email:     req.Email,
		Plan:      domain.TenantPlan(req.Plan),
		TrialDays: req.TrialDays,
	}, requestContext(c))
	if err != nil {
		response.Error(c, err)
		return
	}

	response.Created(c, h.toTenantDetailResponse(c, *tenant))
}

type suspendRequest struct {
	Reason string `json:"reason" binding:"required"`
}

// Suspend — POST /api/v1/clients/:id/suspend
func (h *Tenant) Suspend(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, domain.NewValidationError("id", "некорректный id клиента"))
		return
	}
	var req suspendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, domain.NewValidationError("reason", "причина обязательна"))
		return
	}
	claims, ok := middleware.ClaimsFrom(c)
	if !ok {
		response.Error(c, domain.ErrUnauthenticated)
		return
	}

	tenant, err := h.tenants.Suspend(c.Request.Context(), *claims, id, req.Reason, requestContext(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, h.toTenantDetailResponse(c, *tenant))
}

// Resume — POST /api/v1/clients/:id/resume
func (h *Tenant) Resume(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, domain.NewValidationError("id", "некорректный id клиента"))
		return
	}
	claims, ok := middleware.ClaimsFrom(c)
	if !ok {
		response.Error(c, domain.ErrUnauthenticated)
		return
	}

	tenant, err := h.tenants.Resume(c.Request.Context(), *claims, id, requestContext(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, h.toTenantDetailResponse(c, *tenant))
}

// IssueActivationCode — POST /api/v1/clients/:id/activation-code
func (h *Tenant) IssueActivationCode(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, domain.NewValidationError("id", "некорректный id клиента"))
		return
	}
	claims, ok := middleware.ClaimsFrom(c)
	if !ok {
		response.Error(c, domain.ErrUnauthenticated)
		return
	}

	tenant, err := h.tenants.IssueActivationCode(c.Request.Context(), *claims, id, requestContext(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, h.toTenantDetailResponse(c, *tenant))
}

// Delete — DELETE /api/v1/clients/:id
func (h *Tenant) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, domain.NewValidationError("id", "некорректный id клиента"))
		return
	}
	claims, ok := middleware.ClaimsFrom(c)
	if !ok {
		response.Error(c, domain.ErrUnauthenticated)
		return
	}

	if err := h.tenants.Delete(c.Request.Context(), *claims, id, requestContext(c)); err != nil {
		response.Error(c, err)
		return
	}
	response.NoContent(c)
}

// Journal — GET /api/v1/clients/:id/journal
func (h *Tenant) Journal(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, domain.NewValidationError("id", "некорректный id клиента"))
		return
	}

	entries, _, err := h.journal.List(c.Request.Context(), domain.AuditFilter{
		TargetType: "tenant",
		TargetID:   id.String(),
		Limit:      200,
	})
	if err != nil {
		response.Error(c, err)
		return
	}

	type clientJournalEntry struct {
		ID         string    `json:"id"`
		OccurredAt time.Time `json:"occurred_at"`
		Text       string    `json:"text"`
	}
	out := make([]clientJournalEntry, 0, len(entries))
	for _, e := range entries {
		out = append(out, clientJournalEntry{
			ID:         strconv.FormatInt(e.ID, 10),
			OccurredAt: e.CreatedAt,
			Text:       describeAction(e),
		})
	}
	response.OK(c, out)
}
