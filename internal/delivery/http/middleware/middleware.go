// Package middleware — сквозная обвязка HTTP-слоя.
package middleware

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

const (
	ctxRequestID = "request_id"
	headerReqID  = "X-Request-Id"
)

// RequestID проставляет идентификатор запроса: он попадает в логи, в ответ
// и (позже) в трейсы OpenTelemetry — по нему сшивается вся картина инцидента.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader(headerReqID)
		if id == "" {
			id = uuid.NewString()
		}
		c.Set(ctxRequestID, id)
		c.Header(headerReqID, id)
		c.Next()
	}
}

func RequestIDFrom(c *gin.Context) string {
	if v, ok := c.Get(ctxRequestID); ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// Logger — структурированный лог каждого запроса.
// Ошибки, положенные хендлерами через c.Error, попадают сюда целиком,
// хотя наружу ушла только безопасная формулировка.
func Logger(log zerolog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		c.Next()

		status := c.Writer.Status()
		event := log.Info()
		switch {
		case status >= 500:
			event = log.Error()
		case status >= 400:
			event = log.Warn()
		}

		event = event.
			Str("request_id", RequestIDFrom(c)).
			Str("method", c.Request.Method).
			Str("path", path).
			Int("status", status).
			Dur("latency", time.Since(start)).
			Str("ip", c.ClientIP())

		if query != "" {
			event = event.Str("query", query)
		}
		if sub, ok := SubjectFrom(c); ok {
			event = event.Str("actor_id", sub.UserID).Str("actor_role", string(sub.Role))
		}
		if len(c.Errors) > 0 {
			event = event.Str("error", c.Errors.String())
		}

		event.Msg("http_request")
	}
}

// Recovery превращает панику в 500 с записью в лог, не роняя процесс.
func Recovery(log zerolog.Logger) gin.HandlerFunc {
	return gin.CustomRecoveryWithWriter(nil, func(c *gin.Context, recovered any) {
		log.Error().
			Str("request_id", RequestIDFrom(c)).
			Interface("panic", recovered).
			Str("path", c.Request.URL.Path).
			Msg("panic_recovered")

		c.AbortWithStatus(500)
	})
}
