// Package response — единый формат ответов API и единственное место,
// где доменные ошибки превращаются в HTTP-статусы.
//
// Хендлеры не выбирают статус сами: они возвращают доменную ошибку, а маппинг
// живёт здесь. Иначе один и тот же ErrNotFound со временем станет то 404, то 400.
package response

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/ahmedsila/superadmin/internal/domain"
)

// Envelope — успешный ответ. Данные всегда завёрнуты, чтобы к ответу можно было
// добавить метаданные (пагинацию), не ломая клиентов.
type Envelope struct {
	Data any   `json:"data"`
	Meta *Meta `json:"meta,omitempty"`
}

type Meta struct {
	Total  int64 `json:"total"`
	Limit  int   `json:"limit"`
	Offset int   `json:"offset"`
}

// ErrorBody — форма ошибки. Code машиночитаем, Message — для человека.
type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Field   string `json:"field,omitempty"`
}

type errorEnvelope struct {
	Error ErrorBody `json:"error"`
}

func OK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, Envelope{Data: data})
}

func Created(c *gin.Context, data any) {
	c.JSON(http.StatusCreated, Envelope{Data: data})
}

func List(c *gin.Context, data any, meta Meta) {
	c.JSON(http.StatusOK, Envelope{Data: data, Meta: &meta})
}

func NoContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

// Коды ошибок, которые видит фронтенд.
const (
	CodeNotFound       = "not_found"
	CodeConflict       = "conflict"
	CodeForbidden      = "forbidden"
	CodeUnauthorized   = "unauthorized"
	CodeValidation     = "validation_error"
	CodeInvalidCreds   = "invalid_credentials"
	CodeAccountLocked  = "account_locked"
	CodeSessionRevoked = "session_revoked"
	CodeRateLimited    = "rate_limited"
	CodeInternal       = "internal_error"
	CodeUnavailable    = "service_unavailable"
)

// Error переводит доменную ошибку в HTTP-ответ.
//
// Ошибка кладётся в контекст Gin (c.Error), чтобы logging-middleware записал её
// целиком: наружу уходит только безопасная формулировка, а в логах остаётся всё.
func Error(c *gin.Context, err error) {
	_ = c.Error(err)

	status, body := mapError(err)
	c.AbortWithStatusJSON(status, errorEnvelope{Error: body})
}

func mapError(err error) (int, ErrorBody) {
	var ve *domain.ValidationError
	if errors.As(err, &ve) {
		return http.StatusBadRequest, ErrorBody{
			Code:    CodeValidation,
			Message: ve.Message,
			Field:   ve.Field,
		}
	}

	switch {
	case errors.Is(err, domain.ErrInvalidCredentials):
		// 401, а не 404: существование учётки не подтверждаем
		return http.StatusUnauthorized, ErrorBody{Code: CodeInvalidCreds, Message: domain.ErrInvalidCredentials.Error()}
	case errors.Is(err, domain.ErrAccountLocked):
		return http.StatusTooManyRequests, ErrorBody{Code: CodeAccountLocked, Message: domain.ErrAccountLocked.Error()}
	case errors.Is(err, domain.ErrSessionRevoked):
		return http.StatusUnauthorized, ErrorBody{Code: CodeSessionRevoked, Message: domain.ErrSessionRevoked.Error()}
	case errors.Is(err, domain.ErrUnauthenticated):
		return http.StatusUnauthorized, ErrorBody{Code: CodeUnauthorized, Message: domain.ErrUnauthenticated.Error()}
	case errors.Is(err, domain.ErrForbidden):
		return http.StatusForbidden, ErrorBody{Code: CodeForbidden, Message: domain.ErrForbidden.Error()}
	case errors.Is(err, domain.ErrNotFound):
		return http.StatusNotFound, ErrorBody{Code: CodeNotFound, Message: domain.ErrNotFound.Error()}
	case errors.Is(err, domain.ErrConflict):
		return http.StatusConflict, ErrorBody{Code: CodeConflict, Message: domain.ErrConflict.Error()}
	case errors.Is(err, domain.ErrValidation):
		return http.StatusBadRequest, ErrorBody{Code: CodeValidation, Message: err.Error()}
	default:
		// Ничего внутреннего наружу: детали уже ушли в лог через c.Error
		return http.StatusInternalServerError, ErrorBody{Code: CodeInternal, Message: "внутренняя ошибка сервера"}
	}
}

// Fail — ответ с явным статусом и кодом, когда доменной ошибки нет
// (например, rate limiting на уровне middleware).
func Fail(c *gin.Context, status int, code, message string) {
	c.AbortWithStatusJSON(status, errorEnvelope{Error: ErrorBody{Code: code, Message: message}})
}
