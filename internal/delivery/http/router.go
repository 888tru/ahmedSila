// Package http — сборка HTTP-слоя: роутинг и порядок middleware.
package http

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"

	"github.com/ahmedsila/superadmin/internal/delivery/http/handler"
	"github.com/ahmedsila/superadmin/internal/delivery/http/middleware"
	"github.com/ahmedsila/superadmin/internal/domain"
)

type RouterDeps struct {
	Logger          zerolog.Logger
	AllowedOrigins  []string
	Issuer          domain.TokenIssuer
	Revoker         domain.TokenRevoker
	Authorizer      domain.Authorizer
	AuthHandler     *handler.Auth
	TeamHandler     *handler.Team
	JournalHandler  *handler.Journal
	SettingsHandler *handler.Settings
	OverviewHandler *handler.Overview
	TenantHandler   *handler.Tenant
	TicketHandler   *handler.Ticket
	IsProd          bool
}

// NewRouter собирает маршруты.
//
// Права проверяются per-route через middleware.Require: видно прямо здесь,
// какой эндпоинт что требует, и новый маршрут без проверки бросается в глаза.
func NewRouter(d RouterDeps) *gin.Engine {
	if d.IsProd {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(
		middleware.RequestID(),
		middleware.Recovery(d.Logger),
		middleware.Logger(d.Logger),
		middleware.SecurityHeaders(),
		middleware.CORS(d.AllowedOrigins),
	)

	// Для k8s/Cloud Run probes: без аутентификации, без обращений к БД
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api/v1")

	auth := api.Group("/auth")
	{
		auth.POST("/login", d.AuthHandler.Login)
		auth.POST("/refresh", d.AuthHandler.Refresh)
		// Logout без обязательного токена: разлогиниться должно получаться
		// даже с протухшим access-токеном
		auth.POST("/logout", d.AuthHandler.Logout)
	}

	authenticated := api.Group("")
	authenticated.Use(middleware.Auth(d.Issuer, d.Revoker))
	{
		authenticated.GET("/me", d.AuthHandler.Me)

		team := authenticated.Group("/team")
		{
			team.GET("", middleware.Require(d.Authorizer, domain.ResourceSuperAdmin, domain.ActionRead), d.TeamHandler.List)
			team.POST("/invite", middleware.Require(d.Authorizer, domain.ResourceSuperAdmin, domain.ActionCreate), d.TeamHandler.Invite)
			team.POST("/:id/role", middleware.Require(d.Authorizer, domain.ResourceSuperAdmin, domain.ActionUpdate), d.TeamHandler.UpdateRole)
			team.DELETE("/:id", middleware.Require(d.Authorizer, domain.ResourceSuperAdmin, domain.ActionDelete), d.TeamHandler.Revoke)
		}

		authenticated.GET("/journal", middleware.Require(d.Authorizer, domain.ResourceAuditLog, domain.ActionRead), d.JournalHandler.List)

		settings := authenticated.Group("/settings")
		{
			settings.GET("", middleware.Require(d.Authorizer, domain.ResourceSettings, domain.ActionRead), d.SettingsHandler.Get)
			settings.POST("/message-template", middleware.Require(d.Authorizer, domain.ResourceSettings, domain.ActionUpdate), d.SettingsHandler.SaveMessageTemplate)
		}

		authenticated.GET("/overview", middleware.Require(d.Authorizer, domain.ResourceMetrics, domain.ActionRead), d.OverviewHandler.Get)

		clients := authenticated.Group("/clients")
		{
			readClient := middleware.Require(d.Authorizer, domain.ResourceTenant, domain.ActionRead)
			clients.GET("", readClient, d.TenantHandler.List)
			clients.POST("", middleware.Require(d.Authorizer, domain.ResourceTenant, domain.ActionCreate), d.TenantHandler.Create)
			clients.GET("/email-taken", readClient, d.TenantHandler.EmailTaken)
			clients.GET("/:id", readClient, d.TenantHandler.Get)
			clients.GET("/:id/tickets", middleware.Require(d.Authorizer, domain.ResourceSupportTicket, domain.ActionRead), d.TicketHandler.ListByClient)
			clients.GET("/:id/journal", readClient, d.TenantHandler.Journal)
			clients.POST("/:id/suspend", middleware.Require(d.Authorizer, domain.ResourceTenant, domain.ActionSuspend), d.TenantHandler.Suspend)
			clients.POST("/:id/resume", middleware.Require(d.Authorizer, domain.ResourceTenant, domain.ActionSuspend), d.TenantHandler.Resume)
			clients.POST("/:id/activation-code", middleware.Require(d.Authorizer, domain.ResourceTenant, domain.ActionUpdate), d.TenantHandler.IssueActivationCode)
			clients.DELETE("/:id", middleware.Require(d.Authorizer, domain.ResourceTenant, domain.ActionDelete), d.TenantHandler.Delete)
		}

		tickets := authenticated.Group("/tickets")
		{
			readTicket := middleware.Require(d.Authorizer, domain.ResourceSupportTicket, domain.ActionRead)
			updateTicket := middleware.Require(d.Authorizer, domain.ResourceSupportTicket, domain.ActionUpdate)
			tickets.GET("", readTicket, d.TicketHandler.List)
			tickets.GET("/:id", readTicket, d.TicketHandler.Get)
			tickets.POST("/:id/messages", middleware.Require(d.Authorizer, domain.ResourceSupportTicket, domain.ActionCreate), d.TicketHandler.Reply)
			tickets.POST("/:id/assign", updateTicket, d.TicketHandler.AssignToSelf)
			tickets.POST("/:id/status", updateTicket, d.TicketHandler.UpdateStatus)
			tickets.POST("/:id/priority", updateTicket, d.TicketHandler.UpdatePriority)
		}
	}

	r.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"code": "not_found", "message": "маршрут не найден"}})
	})

	return r
}
