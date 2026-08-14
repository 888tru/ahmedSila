// Package authz — табличная реализация domain.Authorizer.
//
// Это MVP-реализация: матрица «роль × ресурс × действие», заданная кодом.
// Когда появится клиент, которому нужны права тоньше ролей, рядом встанет
// CasbinAuthorizer с тем же интерфейсом, а usecase-слой не изменится
// (TECH_STACK.md §2).
package authz

import (
	"context"
	"sort"

	"github.com/ahmedsila/superadmin/internal/domain"
)

type rule struct {
	resource domain.Resource
	actions  []domain.Action
}

var (
	crudActions   = []domain.Action{domain.ActionRead, domain.ActionCreate, domain.ActionUpdate, domain.ActionDelete}
	tenantActions = []domain.Action{domain.ActionRead, domain.ActionCreate, domain.ActionUpdate, domain.ActionDelete, domain.ActionSuspend}
	ticketActions = []domain.Action{domain.ActionRead, domain.ActionCreate, domain.ActionUpdate}
	readOnly      = []domain.Action{domain.ActionRead}
)

// defaultPolicy — единственное место, где описано, кто что может.
//
//	owner   — всё, включая управление составом команды
//	admin   — всё по клиентам и тикетам, состав команды только читает
//	support — работает с тикетами, тенантов только смотрит
//	viewer  — только чтение, состав команды не видит
var defaultPolicy = map[domain.Role][]rule{
	domain.RoleOwner: {
		{domain.ResourceTenant, tenantActions},
		{domain.ResourceSupportTicket, crudActions},
		{domain.ResourceSuperAdmin, crudActions},
		{domain.ResourceAuditLog, readOnly},
		{domain.ResourceMetrics, readOnly},
	},
	domain.RoleAdmin: {
		{domain.ResourceTenant, tenantActions},
		{domain.ResourceSupportTicket, crudActions},
		{domain.ResourceSuperAdmin, readOnly},
		{domain.ResourceAuditLog, readOnly},
		{domain.ResourceMetrics, readOnly},
	},
	domain.RoleSupport: {
		{domain.ResourceTenant, readOnly},
		{domain.ResourceSupportTicket, ticketActions},
		{domain.ResourceMetrics, readOnly},
	},
	domain.RoleViewer: {
		{domain.ResourceTenant, readOnly},
		{domain.ResourceSupportTicket, readOnly},
		{domain.ResourceAuditLog, readOnly},
		{domain.ResourceMetrics, readOnly},
	},
}

type permissions map[domain.Resource]map[domain.Action]struct{}

// Table потокобезопасна: после New матрица только читается.
type Table struct {
	policy map[domain.Role]permissions
}

var _ domain.Authorizer = (*Table)(nil)

func New() *Table {
	t := &Table{policy: make(map[domain.Role]permissions, len(defaultPolicy))}
	for role, rules := range defaultPolicy {
		perms := make(permissions, len(rules))
		for _, r := range rules {
			if perms[r.resource] == nil {
				perms[r.resource] = make(map[domain.Action]struct{}, len(r.actions))
			}
			for _, a := range r.actions {
				perms[r.resource][a] = struct{}{}
			}
		}
		t.policy[role] = perms
	}
	return t
}

func (t *Table) Can(s domain.Subject, res domain.Resource, act domain.Action) bool {
	actions, ok := t.policy[s.Role][res]
	if !ok {
		return false
	}
	_, ok = actions[act]
	return ok
}

func (t *Table) Authorize(_ context.Context, s domain.Subject, res domain.Resource, act domain.Action) error {
	if !t.Can(s, res, act) {
		return domain.ErrForbidden
	}
	return nil
}

// Permissions отдаёт фронтенду плоский отсортированный список прав роли
// ("tenant:read", ...), чтобы UI не догадывался, какие кнопки показывать, а знал.
func (t *Table) Permissions(role domain.Role) []string {
	perms := t.policy[role]
	out := make([]string, 0, len(perms)*len(crudActions))
	for res, actions := range perms {
		for act := range actions {
			out = append(out, string(res)+":"+string(act))
		}
	}
	sort.Strings(out)
	return out
}
