package middleware

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// CORS со строгим whitelist'ом. Написано руками, а не взято библиотекой:
// правило здесь одно, зато видно целиком и нет соблазна поставить "*".
//
// Wildcard невозможен по построению — origin отражается, только если он
// в списке, и всегда вместе с Allow-Credentials (нужен для refresh-cookie).
func CORS(allowedOrigins []string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[strings.TrimRight(strings.TrimSpace(o), "/")] = struct{}{}
	}

	const maxAge = 12 * time.Hour

	return func(c *gin.Context) {
		origin := strings.TrimRight(c.GetHeader("Origin"), "/")
		if origin == "" {
			c.Next()
			return
		}

		if _, ok := allowed[origin]; !ok {
			// Заголовков не ставим — браузер сам отклонит ответ.
			// Preflight при этом заканчиваем, чтобы не пускать запрос дальше.
			if c.Request.Method == http.MethodOptions {
				c.AbortWithStatus(http.StatusForbidden)
				return
			}
			c.Next()
			return
		}

		h := c.Writer.Header()
		h.Set("Access-Control-Allow-Origin", origin)
		h.Set("Access-Control-Allow-Credentials", "true")
		// Ответ зависит от Origin — иначе кэш отдаст чужие заголовки
		h.Add("Vary", "Origin")

		if c.Request.Method == http.MethodOptions {
			h.Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
			h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-Id")
			h.Set("Access-Control-Max-Age", strconv.Itoa(int(maxAge.Seconds())))
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		h.Set("Access-Control-Expose-Headers", "X-Request-Id")
		c.Next()
	}
}

// SecurityHeaders — базовый набор заголовков для API.
//
// CSP здесь строгая и «пустая»: API не отдаёт HTML, поэтому ему нечего
// разрешать. Политика для самого фронтенда задаётся при его раздаче.
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.Writer.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		c.Next()
	}
}
