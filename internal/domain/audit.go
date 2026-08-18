package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Действия, попадающие в аудит. Константы, а не строковые литералы по коду:
// иначе через полгода в логе будут "tenant.suspend", "suspend_tenant" и "SUSPEND".
const (
	AuditLoginSuccess     = "auth.login.success"
	AuditLoginFailure     = "auth.login.failure"
	AuditLogout           = "auth.logout"
	AuditTokenRefresh     = "auth.token.refresh"
	AuditTokenReuse       = "auth.token.reuse_detected"
	AuditSessionsRevoked  = "auth.sessions.revoked"
	AuditTenantCreated    = "tenant.created"
	AuditTenantUpdated    = "tenant.updated"
	AuditTenantSuspended  = "tenant.suspended"
	AuditTenantResumed    = "tenant.resumed"
	AuditSuperAdminCreate = "super_admin.created"

	AuditSuperAdminInvited       = "super_admin.invited"
	AuditSuperAdminRoleChanged   = "super_admin.role_changed"
	AuditSuperAdminAccessRevoked = "super_admin.access_revoked"
	AuditMessageTemplateUpdated  = "settings.message_template.updated"

	AuditTenantActivationCodeIssued = "tenant.activation_code_issued"
	AuditTenantDeleted              = "tenant.deleted"

	AuditTicketReplied         = "support_ticket.replied"
	AuditTicketAssigned        = "support_ticket.assigned"
	AuditTicketStatusChanged   = "support_ticket.status_changed"
	AuditTicketPriorityChanged = "support_ticket.priority_changed"
)

// AuditEntry — одна запись журнала.
//
// ActorEmail дублирует email намеренно: запись должна оставаться читаемой
// после удаления пользователя (actor_id тогда обнулится).
type AuditEntry struct {
	ID         int64
	ActorID    *uuid.UUID
	ActorEmail string
	Action     string
	TargetType string
	TargetID   string
	Metadata   map[string]any
	IP         string
	UserAgent  string
	CreatedAt  time.Time
}

// AuditFilter — параметры выборки для экрана аудита.
type AuditFilter struct {
	ActorID    *uuid.UUID
	Action     string
	TargetType string
	TargetID   string
	From       *time.Time
	To         *time.Time
	Limit      int
	Offset     int
}

// AuditRepository — хранилище журнала.
type AuditRepository interface {
	// Write не должен ронять основную операцию: реализация логирует ошибку
	// записи, но вызывающий код её не обрабатывает как фатальную.
	Write(ctx context.Context, e AuditEntry) error
	List(ctx context.Context, f AuditFilter) ([]AuditEntry, int64, error)
}
