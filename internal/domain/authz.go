package domain

import "context"

// Resource и Action — словарь прав. Проверка всегда идёт через Authorizer,
// а не через `if user.Role == "admin"` по коду (TECH_STACK.md §2).
type Resource string

const (
	ResourceTenant        Resource = "tenant"
	ResourceSupportTicket Resource = "support_ticket"
	ResourceSuperAdmin    Resource = "super_admin"
	ResourceAuditLog      Resource = "audit_log"
	ResourceMetrics       Resource = "metrics"
	ResourceSettings      Resource = "settings"
)

type Action string

const (
	ActionRead    Action = "read"
	ActionCreate  Action = "create"
	ActionUpdate  Action = "update"
	ActionDelete  Action = "delete"
	ActionSuspend Action = "suspend"
)

// Subject — кто выполняет действие. Отдельный тип, а не голая Role:
// когда появятся права под конкретного клиента, сюда добавятся атрибуты,
// и сигнатура Authorizer не изменится.
type Subject struct {
	UserID string
	Role   Role
}

// Authorizer — порт авторизации.
//
// MVP: табличная реализация (internal/pkg/authz) — матрица «роль × ресурс × действие».
// Позже: CasbinAuthorizer, реализующий тот же интерфейс. Гранулярные права
// под крупного клиента станут правкой policy, а не кода usecase.
type Authorizer interface {
	// Authorize возвращает nil, если можно, и ErrForbidden, если нельзя.
	Authorize(ctx context.Context, s Subject, res Resource, act Action) error
	// Can — та же проверка без ошибки, для отдачи прав фронтенду
	// (какие кнопки показывать).
	Can(s Subject, res Resource, act Action) bool
}
