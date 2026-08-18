package usecase

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/ahmedsila/superadmin/internal/domain"
)

// invitationTTL — семь дней, как у кода подтверждения клиента: тот же срок
// удобнее держать в голове одним числом на весь продукт.
const invitationTTL = 7 * 24 * time.Hour

// invitableRoles — кого можно пригласить или назначить через UpdateRole.
// Owner нет ни там, ни там: передача владения — отдельный, более
// ответственный флоу, которого пока нет (см. CLAUDE.md, «Дальше»), а не
// пункт в общем списке ролей.
var invitableRoles = map[domain.Role]bool{
	domain.RoleAdmin:   true,
	domain.RoleSupport: true,
	domain.RoleViewer:  true,
}

type Team struct {
	users   domain.SuperAdminRepository
	invites domain.InvitationRepository
	tokens  domain.RefreshTokenRepository
	audit   domain.AuditRepository
	clock   domain.Clock
}

func NewTeam(
	users domain.SuperAdminRepository,
	invites domain.InvitationRepository,
	tokens domain.RefreshTokenRepository,
	audit domain.AuditRepository,
	clock domain.Clock,
) *Team {
	return &Team{users: users, invites: invites, tokens: tokens, audit: audit, clock: clock}
}

// List отдаёт только активных сотрудников: отозванный доступ убирает
// человека из ростера, а не просто помечает серым (PAGES.md §7).
func (t *Team) List(ctx context.Context) ([]domain.SuperAdminUser, error) {
	all, err := t.users.List(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]domain.SuperAdminUser, 0, len(all))
	for _, u := range all {
		if u.Status == domain.UserStatusActive {
			out = append(out, u)
		}
	}
	return out, nil
}

// Invite заводит приглашение и возвращает токен активации один раз — он
// не хранится нигде, кроме этого возврата (ср. код подтверждения клиента).
// Реальная отправка письма — отдельная задача, сейчас токен только
// генерируется (CLAUDE.md, «Дальше»).
func (t *Team) Invite(ctx context.Context, actor domain.AccessClaims, email string, role domain.Role, rc domain.RequestContext) (*domain.Invitation, string, error) {
	if !invitableRoles[role] {
		return nil, "", domain.NewValidationError("role", "недопустимая роль для приглашения")
	}

	if _, err := t.users.GetByEmail(ctx, email); err == nil {
		return nil, "", fmt.Errorf("%w: сотрудник с таким email уже в команде", domain.ErrConflict)
	} else if !errors.Is(err, domain.ErrNotFound) {
		return nil, "", err
	}

	pending, err := t.invites.HasPending(ctx, email)
	if err != nil {
		return nil, "", err
	}
	if pending {
		return nil, "", fmt.Errorf("%w: этот сотрудник уже приглашён", domain.ErrConflict)
	}

	rawToken, err := generateSecureToken()
	if err != nil {
		return nil, "", err
	}

	now := t.clock.Now()
	inv := &domain.Invitation{
		Email:     email,
		Role:      role,
		TokenHash: hashToken(rawToken),
		InvitedBy: &actor.UserID,
		ExpiresAt: now.Add(invitationTTL),
	}
	if err := t.invites.Create(ctx, inv); err != nil {
		return nil, "", err
	}

	t.writeAudit(ctx, domain.AuditEntry{
		ActorID:    &actor.UserID,
		ActorEmail: actor.Email,
		Action:     domain.AuditSuperAdminInvited,
		TargetType: string(domain.ResourceSuperAdmin),
		Metadata:   map[string]any{"email": email, "role": string(role)},
		IP:         rc.IP,
		UserAgent:  rc.UserAgent,
		CreatedAt:  now,
	})

	return inv, rawToken, nil
}

// UpdateRole меняет роль сотрудника. Роль владельца — ни у самого владельца,
// ни назначаемая кому-то ещё: единственность владельца — инвариант, который
// иначе пришлось бы проверять в каждом месте, где роль читается.
func (t *Team) UpdateRole(ctx context.Context, actor domain.AccessClaims, memberID uuid.UUID, role domain.Role, rc domain.RequestContext) (*domain.SuperAdminUser, error) {
	if !invitableRoles[role] {
		return nil, domain.NewValidationError("role", "недопустимая роль")
	}

	member, err := t.users.GetByID(ctx, memberID)
	if err != nil {
		return nil, err
	}
	if member.Role == domain.RoleOwner {
		return nil, fmt.Errorf("%w: роль владельца изменить нельзя", domain.ErrForbidden)
	}

	previousRole := member.Role
	updated, err := t.users.UpdateRole(ctx, memberID, role)
	if err != nil {
		return nil, err
	}

	t.writeAudit(ctx, domain.AuditEntry{
		ActorID:    &actor.UserID,
		ActorEmail: actor.Email,
		Action:     domain.AuditSuperAdminRoleChanged,
		TargetType: string(domain.ResourceSuperAdmin),
		TargetID:   memberID.String(),
		Metadata:   map[string]any{"email": updated.Email, "from": string(previousRole), "to": string(role)},
		IP:         rc.IP,
		UserAgent:  rc.UserAgent,
		CreatedAt:  t.clock.Now(),
	})

	return updated, nil
}

// Revoke приостанавливает доступ и закрывает все активные сессии сотрудника —
// то же самое, что LogoutAll, только инициировано другим человеком, а не им
// самим (Auth.LogoutAll). Строка в таблице не удаляется: запись в аудите
// должна остаться читаемой, а не превратиться в actor_id = NULL раньше времени.
func (t *Team) Revoke(ctx context.Context, actor domain.AccessClaims, memberID uuid.UUID, rc domain.RequestContext) error {
	member, err := t.users.GetByID(ctx, memberID)
	if err != nil {
		return err
	}
	if member.Role == domain.RoleOwner {
		return fmt.Errorf("%w: у владельца нельзя отозвать доступ", domain.ErrForbidden)
	}

	now := t.clock.Now()
	if _, err := t.users.UpdateStatus(ctx, memberID, domain.UserStatusSuspended); err != nil {
		return err
	}
	if err := t.tokens.RevokeAllForUser(ctx, memberID, domain.RevokeReasonUserDisabled, now); err != nil {
		return err
	}

	t.writeAudit(ctx, domain.AuditEntry{
		ActorID:    &actor.UserID,
		ActorEmail: actor.Email,
		Action:     domain.AuditSuperAdminAccessRevoked,
		TargetType: string(domain.ResourceSuperAdmin),
		TargetID:   memberID.String(),
		Metadata:   map[string]any{"email": member.Email},
		IP:         rc.IP,
		UserAgent:  rc.UserAgent,
		CreatedAt:  now,
	})

	return nil
}

func (t *Team) writeAudit(ctx context.Context, e domain.AuditEntry) {
	_ = t.audit.Write(ctx, e)
}
