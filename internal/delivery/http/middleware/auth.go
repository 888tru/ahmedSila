package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/ahmedsila/superadmin/internal/delivery/http/response"
	"github.com/ahmedsila/superadmin/internal/domain"
)

const (
	ctxClaims  = "access_claims"
	ctxSubject = "subject"
)

// Auth проверяет access-токен: подпись и срок — локально, отзыв — в Redis.
//
// Поведение при недоступности Redis — fail-closed: запрос отклоняется с 503.
// Это внутренняя панель команды, и цена ложного отказа здесь несопоставима
// с ценой пропуска отозванного токена. Для контура тенантов такое же решение
// принимать отдельно — там отказ означает вставший магазин (TECH_STACK.md §9).
func Auth(issuer domain.TokenIssuer, revoker domain.TokenRevoker) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, ok := bearerToken(c)
		if !ok {
			response.Fail(c, 401, response.CodeUnauthorized, "требуется авторизация")
			return
		}

		claims, err := issuer.Parse(raw)
		if err != nil {
			_ = c.Error(err)
			response.Fail(c, 401, response.CodeUnauthorized, "некорректный или истёкший токен")
			return
		}

		revoked, err := revoker.IsRevoked(c.Request.Context(), claims.TokenID)
		if err != nil {
			_ = c.Error(err)
			response.Fail(c, 503, response.CodeUnavailable, "проверка сессии временно недоступна")
			return
		}
		if revoked {
			response.Fail(c, 401, response.CodeSessionRevoked, domain.ErrSessionRevoked.Error())
			return
		}

		c.Set(ctxClaims, claims)
		c.Set(ctxSubject, domain.Subject{UserID: claims.UserID.String(), Role: claims.Role})
		c.Next()
	}
}

// Require — проверка права на действие. Вешается на конкретный маршрут,
// поэтому забыть её на новом эндпоинте заметно при чтении router.go.
func Require(authorizer domain.Authorizer, res domain.Resource, act domain.Action) gin.HandlerFunc {
	return func(c *gin.Context) {
		sub, ok := SubjectFrom(c)
		if !ok {
			response.Fail(c, 401, response.CodeUnauthorized, "требуется авторизация")
			return
		}
		if err := authorizer.Authorize(c.Request.Context(), sub, res, act); err != nil {
			response.Error(c, err)
			return
		}
		c.Next()
	}
}

func ClaimsFrom(c *gin.Context) (*domain.AccessClaims, bool) {
	v, ok := c.Get(ctxClaims)
	if !ok {
		return nil, false
	}
	claims, ok := v.(*domain.AccessClaims)
	return claims, ok
}

func SubjectFrom(c *gin.Context) (domain.Subject, bool) {
	v, ok := c.Get(ctxSubject)
	if !ok {
		return domain.Subject{}, false
	}
	sub, ok := v.(domain.Subject)
	return sub, ok
}

func bearerToken(c *gin.Context) (string, bool) {
	header := c.GetHeader("Authorization")
	if header == "" {
		return "", false
	}
	const prefix = "Bearer "
	if len(header) <= len(prefix) || !strings.EqualFold(header[:len(prefix)], prefix) {
		return "", false
	}
	token := strings.TrimSpace(header[len(prefix):])
	return token, token != ""
}
