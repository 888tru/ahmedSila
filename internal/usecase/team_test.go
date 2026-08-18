package usecase_test

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/ahmedsila/superadmin/internal/domain"
	"github.com/ahmedsila/superadmin/internal/usecase"
)

type teamFixture struct {
	team    *usecase.Team
	users   *fakeUsers
	invites *fakeInvitations
	tokens  *fakeTokens
	audit   *fakeAudit
	clock   *testClock
	owner   *domain.SuperAdminUser
	member  *domain.SuperAdminUser
	actor   domain.AccessClaims
}

func newTeamFixture(t *testing.T) *teamFixture {
	t.Helper()

	clock := newTestClock(time.Date(2026, 8, 13, 12, 0, 0, 0, time.UTC))

	owner := &domain.SuperAdminUser{
		ID: uuid.New(), Email: "owner@example.com", FullName: "Owner",
		Role: domain.RoleOwner, Status: domain.UserStatusActive,
	}
	member := &domain.SuperAdminUser{
		ID: uuid.New(), Email: "support@example.com", FullName: "Support",
		Role: domain.RoleSupport, Status: domain.UserStatusActive,
	}

	users := newFakeUsers()
	users.add(owner)
	users.add(member)
	invites := newFakeInvitations()
	tokens := newFakeTokens()
	audit := &fakeAudit{}

	team := usecase.NewTeam(users, invites, tokens, audit, clock)

	return &teamFixture{
		team: team, users: users, invites: invites, tokens: tokens, audit: audit, clock: clock,
		owner: owner, member: member,
		actor: domain.AccessClaims{UserID: owner.ID, Email: owner.Email, Role: owner.Role},
	}
}

func TestTeam_List_ExcludesSuspended(t *testing.T) {
	f := newTeamFixture(t)
	if _, err := f.users.UpdateStatus(context.Background(), f.member.ID, domain.UserStatusSuspended); err != nil {
		t.Fatalf("UpdateStatus: %v", err)
	}

	list, err := f.team.List(context.Background())
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 1 || list[0].ID != f.owner.ID {
		t.Fatalf("ожидали только владельца, получили %+v", list)
	}
}

func TestTeam_Invite_Success(t *testing.T) {
	f := newTeamFixture(t)

	inv, token, err := f.team.Invite(context.Background(), f.actor, "new.hire@example.com", domain.RoleSupport, domain.RequestContext{})
	if err != nil {
		t.Fatalf("Invite: %v", err)
	}
	if token == "" {
		t.Fatal("токен активации не должен быть пустым")
	}
	if inv.Email != "new.hire@example.com" || inv.Role != domain.RoleSupport {
		t.Fatalf("неожиданное приглашение: %+v", inv)
	}
	if !slices.Contains(f.audit.actions(), domain.AuditSuperAdminInvited) {
		t.Fatal("ожидали запись в аудите о приглашении")
	}
}

func TestTeam_Invite_RejectsOwnerRole(t *testing.T) {
	f := newTeamFixture(t)

	_, _, err := f.team.Invite(context.Background(), f.actor, "new.hire@example.com", domain.RoleOwner, domain.RequestContext{})
	var ve *domain.ValidationError
	if !errors.As(err, &ve) {
		t.Fatalf("ожидали ValidationError, получили %v", err)
	}
}

func TestTeam_Invite_RejectsExistingMember(t *testing.T) {
	f := newTeamFixture(t)

	_, _, err := f.team.Invite(context.Background(), f.actor, f.member.Email, domain.RoleSupport, domain.RequestContext{})
	if !errors.Is(err, domain.ErrConflict) {
		t.Fatalf("ожидали ErrConflict, получили %v", err)
	}
}

func TestTeam_Invite_RejectsAlreadyPending(t *testing.T) {
	f := newTeamFixture(t)

	if _, _, err := f.team.Invite(context.Background(), f.actor, "new.hire@example.com", domain.RoleSupport, domain.RequestContext{}); err != nil {
		t.Fatalf("первое приглашение: %v", err)
	}
	_, _, err := f.team.Invite(context.Background(), f.actor, "new.hire@example.com", domain.RoleSupport, domain.RequestContext{})
	if !errors.Is(err, domain.ErrConflict) {
		t.Fatalf("ожидали ErrConflict на повторное приглашение, получили %v", err)
	}
}

func TestTeam_UpdateRole_RejectsChangingOwner(t *testing.T) {
	f := newTeamFixture(t)

	_, err := f.team.UpdateRole(context.Background(), f.actor, f.owner.ID, domain.RoleAdmin, domain.RequestContext{})
	if !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("ожидали ErrForbidden, получили %v", err)
	}
}

func TestTeam_UpdateRole_RejectsAssigningOwner(t *testing.T) {
	f := newTeamFixture(t)

	_, err := f.team.UpdateRole(context.Background(), f.actor, f.member.ID, domain.RoleOwner, domain.RequestContext{})
	var ve *domain.ValidationError
	if !errors.As(err, &ve) {
		t.Fatalf("ожидали ValidationError, получили %v", err)
	}
}

func TestTeam_UpdateRole_Success(t *testing.T) {
	f := newTeamFixture(t)

	updated, err := f.team.UpdateRole(context.Background(), f.actor, f.member.ID, domain.RoleAdmin, domain.RequestContext{})
	if err != nil {
		t.Fatalf("UpdateRole: %v", err)
	}
	if updated.Role != domain.RoleAdmin {
		t.Fatalf("ожидали роль admin, получили %s", updated.Role)
	}
	if !slices.Contains(f.audit.actions(), domain.AuditSuperAdminRoleChanged) {
		t.Fatal("ожидали запись в аудите о смене роли")
	}
}

func TestTeam_Revoke_RejectsOwner(t *testing.T) {
	f := newTeamFixture(t)

	err := f.team.Revoke(context.Background(), f.actor, f.owner.ID, domain.RequestContext{})
	if !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("ожидали ErrForbidden, получили %v", err)
	}
}

func TestTeam_Revoke_SuspendsAndClosesSessions(t *testing.T) {
	f := newTeamFixture(t)
	session := uuid.New()
	if err := f.tokens.Create(context.Background(), &domain.RefreshToken{
		ID: uuid.New(), UserID: f.member.ID, SessionID: session,
		TokenHash: []byte("hash"), ExpiresAt: f.clock.Now().Add(time.Hour),
	}); err != nil {
		t.Fatalf("Create token: %v", err)
	}

	if err := f.team.Revoke(context.Background(), f.actor, f.member.ID, domain.RequestContext{}); err != nil {
		t.Fatalf("Revoke: %v", err)
	}

	updated, err := f.users.GetByID(context.Background(), f.member.ID)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if updated.Status != domain.UserStatusSuspended {
		t.Fatalf("ожидали статус suspended, получили %s", updated.Status)
	}

	for _, tok := range f.tokens.all() {
		if tok.UserID == f.member.ID && tok.RevokedAt == nil {
			t.Fatal("ожидали, что сессия сотрудника будет отозвана")
		}
	}
	if !slices.Contains(f.audit.actions(), domain.AuditSuperAdminAccessRevoked) {
		t.Fatal("ожидали запись в аудите об отзыве доступа")
	}
}
