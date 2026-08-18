package handler

import (
	"time"

	"github.com/gin-gonic/gin"

	"github.com/ahmedsila/superadmin/internal/delivery/http/middleware"
	"github.com/ahmedsila/superadmin/internal/delivery/http/response"
	"github.com/ahmedsila/superadmin/internal/domain"
	"github.com/ahmedsila/superadmin/internal/usecase"
)

type Settings struct {
	settings *usecase.Settings
}

func NewSettings(settings *usecase.Settings) *Settings {
	return &Settings{settings: settings}
}

type planResponse struct {
	Plan     string `json:"plan"`
	Limit    string `json:"limit"`
	Price    string `json:"price"`
	Includes string `json:"includes"`
}

type messageTemplateResponse struct {
	Text      string  `json:"text"`
	UpdatedAt *string `json:"updated_at"`
}

type settingsResponse struct {
	Plans    []planResponse          `json:"plans"`
	Template messageTemplateResponse `json:"template"`
}

func toMessageTemplateResponse(t *domain.MessageTemplate) messageTemplateResponse {
	out := messageTemplateResponse{Text: t.Body}
	if t.UpdatedAt != nil {
		s := t.UpdatedAt.Format(time.RFC3339)
		out.UpdatedAt = &s
	}
	return out
}

// Get — GET /api/v1/settings
func (h *Settings) Get(c *gin.Context) {
	tpl, err := h.settings.Template(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}

	plans := h.settings.Plans()
	out := settingsResponse{Plans: make([]planResponse, 0, len(plans)), Template: toMessageTemplateResponse(tpl)}
	for _, p := range plans {
		out.Plans = append(out.Plans, planResponse{Plan: p.Plan, Limit: p.Limit, Price: p.Price, Includes: p.Includes})
	}

	response.OK(c, out)
}

type saveTemplateRequest struct {
	Text string `json:"text" binding:"required,max=4000"`
}

// SaveMessageTemplate — POST /api/v1/settings/message-template
func (h *Settings) SaveMessageTemplate(c *gin.Context) {
	var req saveTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, domain.NewValidationError("text", "текст шаблона обязателен"))
		return
	}

	claims, ok := middleware.ClaimsFrom(c)
	if !ok {
		response.Error(c, domain.ErrUnauthenticated)
		return
	}

	tpl, err := h.settings.SaveTemplate(c.Request.Context(), *claims, req.Text, requestContext(c))
	if err != nil {
		response.Error(c, err)
		return
	}

	response.OK(c, toMessageTemplateResponse(tpl))
}
