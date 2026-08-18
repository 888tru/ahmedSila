package handler

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/ahmedsila/superadmin/internal/delivery/http/middleware"
	"github.com/ahmedsila/superadmin/internal/delivery/http/response"
	"github.com/ahmedsila/superadmin/internal/domain"
	"github.com/ahmedsila/superadmin/internal/usecase"
)

type Team struct {
	team *usecase.Team
}

func NewTeam(team *usecase.Team) *Team {
	return &Team{team: team}
}

type teamMemberResponse struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	Email            string  `json:"email"`
	Role             string  `json:"role"`
	TwoFactorEnabled bool    `json:"two_factor_enabled"`
	LastLoginAt      *string `json:"last_login_at"`
	IsMe             bool    `json:"is_me"`
}

func toTeamMemberResponse(u domain.SuperAdminUser, actorID uuid.UUID) teamMemberResponse {
	out := teamMemberResponse{
		ID:               u.ID.String(),
		Name:             u.FullName,
		Email:            u.Email,
		Role:             string(u.Role),
		TwoFactorEnabled: u.TOTPEnrolledAt != nil,
		IsMe:             u.ID == actorID,
	}
	if u.LastLoginAt != nil {
		s := u.LastLoginAt.Format(time.RFC3339)
		out.LastLoginAt = &s
	}
	return out
}

// List — GET /api/v1/team
func (h *Team) List(c *gin.Context) {
	claims, ok := middleware.ClaimsFrom(c)
	if !ok {
		response.Error(c, domain.ErrUnauthenticated)
		return
	}

	members, err := h.team.List(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}

	out := make([]teamMemberResponse, 0, len(members))
	for _, m := range members {
		out = append(out, toTeamMemberResponse(m, claims.UserID))
	}
	response.OK(c, out)
}

type inviteRequest struct {
	Email string `json:"email" binding:"required,email,max=255"`
	Role  string `json:"role" binding:"required"`
}

type invitationResponse struct {
	Email           string    `json:"email"`
	Role            string    `json:"role"`
	ActivationToken string    `json:"activation_token"`
	ExpiresAt       time.Time `json:"expires_at"`
}

// Invite — POST /api/v1/team/invite
func (h *Team) Invite(c *gin.Context) {
	var req inviteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, domain.NewValidationError("body", "укажите email и роль"))
		return
	}

	claims, ok := middleware.ClaimsFrom(c)
	if !ok {
		response.Error(c, domain.ErrUnauthenticated)
		return
	}

	inv, token, err := h.team.Invite(c.Request.Context(), *claims, req.Email, domain.Role(req.Role), requestContext(c))
	if err != nil {
		response.Error(c, err)
		return
	}

	response.Created(c, invitationResponse{
		Email:           inv.Email,
		Role:            string(inv.Role),
		ActivationToken: token,
		ExpiresAt:       inv.ExpiresAt,
	})
}

type updateRoleRequest struct {
	Role string `json:"role" binding:"required"`
}

// UpdateRole — POST /api/v1/team/:id/role
func (h *Team) UpdateRole(c *gin.Context) {
	memberID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, domain.NewValidationError("id", "некорректный id сотрудника"))
		return
	}

	var req updateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, domain.NewValidationError("body", "укажите роль"))
		return
	}

	claims, ok := middleware.ClaimsFrom(c)
	if !ok {
		response.Error(c, domain.ErrUnauthenticated)
		return
	}

	updated, err := h.team.UpdateRole(c.Request.Context(), *claims, memberID, domain.Role(req.Role), requestContext(c))
	if err != nil {
		response.Error(c, err)
		return
	}

	response.OK(c, toTeamMemberResponse(*updated, claims.UserID))
}

// Revoke — DELETE /api/v1/team/:id
func (h *Team) Revoke(c *gin.Context) {
	memberID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, domain.NewValidationError("id", "некорректный id сотрудника"))
		return
	}

	claims, ok := middleware.ClaimsFrom(c)
	if !ok {
		response.Error(c, domain.ErrUnauthenticated)
		return
	}

	if err := h.team.Revoke(c.Request.Context(), *claims, memberID, requestContext(c)); err != nil {
		response.Error(c, err)
		return
	}

	response.NoContent(c)
}
