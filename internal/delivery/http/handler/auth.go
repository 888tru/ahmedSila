// Package handler — HTTP-хендлеры. Здесь нет бизнес-логики: разбор запроса,
// вызов usecase, формирование ответа.
package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/ahmedsila/superadmin/internal/delivery/http/middleware"
	"github.com/ahmedsila/superadmin/internal/delivery/http/response"
	"github.com/ahmedsila/superadmin/internal/domain"
	"github.com/ahmedsila/superadmin/internal/usecase"
)

// refreshCookieName — refresh живёт только в httpOnly-cookie и никогда
// не отдаётся в теле ответа: JS не должен иметь к нему доступа.
const refreshCookieName = "refresh_token"

// CookieConfig — параметры refresh-cookie.
type CookieConfig struct {
	// Path сужен до auth-эндпоинтов: cookie не уезжает с каждым запросом к API
	Path   string
	Domain string
	Secure bool
	MaxAge time.Duration
}

func DefaultCookieConfig(secure bool, maxAge time.Duration) CookieConfig {
	return CookieConfig{Path: "/api/v1/auth", Secure: secure, MaxAge: maxAge}
}

// permissionLister отдаёт список прав роли. Отдельный узкий интерфейс:
// хендлеру не нужен весь Authorizer.
type permissionLister interface {
	Permissions(role domain.Role) []string
}

type Auth struct {
	auth   *usecase.Auth
	perms  permissionLister
	cookie CookieConfig
}

func NewAuth(auth *usecase.Auth, perms permissionLister, cookie CookieConfig) *Auth {
	return &Auth{auth: auth, perms: perms, cookie: cookie}
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email,max=255"`
	Password string `json:"password" binding:"required,min=8,max=256"`
}

type userResponse struct {
	ID          string   `json:"id"`
	Email       string   `json:"email"`
	FullName    string   `json:"full_name"`
	Role        string   `json:"role"`
	Permissions []string `json:"permissions"`
	LastLoginAt *string  `json:"last_login_at"`
}

type tokenResponse struct {
	AccessToken string       `json:"access_token"`
	ExpiresAt   time.Time    `json:"expires_at"`
	User        userResponse `json:"user"`
}

// Login — POST /api/v1/auth/login
func (h *Auth) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, domain.NewValidationError("body", "email и пароль обязательны"))
		return
	}

	pair, user, err := h.auth.Login(c.Request.Context(), domain.Credentials{
		Email:    req.Email,
		Password: req.Password,
	}, requestContext(c))
	if err != nil {
		response.Error(c, err)
		return
	}

	h.setRefreshCookie(c, pair.RefreshToken)
	response.OK(c, tokenResponse{
		AccessToken: pair.AccessToken,
		ExpiresAt:   pair.AccessExpiresAt,
		User:        h.toUserResponse(user),
	})
}

// Refresh — POST /api/v1/auth/refresh. Токен берётся из cookie.
func (h *Auth) Refresh(c *gin.Context) {
	raw, err := c.Cookie(refreshCookieName)
	if err != nil || raw == "" {
		response.Error(c, domain.ErrUnauthenticated)
		return
	}

	pair, err := h.auth.Refresh(c.Request.Context(), raw, requestContext(c))
	if err != nil {
		// Сессия мертва — гасим cookie, чтобы клиент не долбился ею снова
		if errors.Is(err, domain.ErrSessionRevoked) || errors.Is(err, domain.ErrUnauthenticated) {
			h.clearRefreshCookie(c)
		}
		response.Error(c, err)
		return
	}

	h.setRefreshCookie(c, pair.RefreshToken)
	response.OK(c, gin.H{
		"access_token": pair.AccessToken,
		"expires_at":   pair.AccessExpiresAt,
	})
}

// Logout — POST /api/v1/auth/logout. Работает и без валидного access-токена:
// разлогиниться должно получаться всегда.
func (h *Auth) Logout(c *gin.Context) {
	raw, _ := c.Cookie(refreshCookieName)
	claims, _ := middleware.ClaimsFrom(c)

	if err := h.auth.Logout(c.Request.Context(), raw, claims, requestContext(c)); err != nil {
		response.Error(c, err)
		return
	}

	h.clearRefreshCookie(c)
	response.NoContent(c)
}

// Me — GET /api/v1/me. Данные берутся из БД, а не из claims: роль могли
// изменить уже после выдачи токена.
func (h *Auth) Me(c *gin.Context) {
	claims, ok := middleware.ClaimsFrom(c)
	if !ok {
		response.Error(c, domain.ErrUnauthenticated)
		return
	}

	user, err := h.auth.Me(c.Request.Context(), claims.UserID)
	if err != nil {
		response.Error(c, err)
		return
	}

	response.OK(c, h.toUserResponse(user))
}

func (h *Auth) toUserResponse(u *domain.SuperAdminUser) userResponse {
	out := userResponse{
		ID:          u.ID.String(),
		Email:       u.Email,
		FullName:    u.FullName,
		Role:        string(u.Role),
		Permissions: h.perms.Permissions(u.Role),
	}
	if u.LastLoginAt != nil {
		s := u.LastLoginAt.Format(time.RFC3339)
		out.LastLoginAt = &s
	}
	return out
}

func (h *Auth) setRefreshCookie(c *gin.Context, token string) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     refreshCookieName,
		Value:    token,
		Path:     h.cookie.Path,
		Domain:   h.cookie.Domain,
		MaxAge:   int(h.cookie.MaxAge.Seconds()),
		Secure:   h.cookie.Secure,
		HttpOnly: true,
		// Strict: панель открывается напрямую, межсайтовых переходов в неё нет
		SameSite: http.SameSiteStrictMode,
	})
}

func (h *Auth) clearRefreshCookie(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     refreshCookieName,
		Value:    "",
		Path:     h.cookie.Path,
		Domain:   h.cookie.Domain,
		MaxAge:   -1,
		Secure:   h.cookie.Secure,
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
	})
}

func requestContext(c *gin.Context) domain.RequestContext {
	return domain.RequestContext{
		IP:        c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
	}
}
