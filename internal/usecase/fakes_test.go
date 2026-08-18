package usecase_test

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/ahmedsila/superadmin/internal/domain"
)

// Ручные фейки вместо моков-по-generated-коду: интерфейсы domain маленькие,
// а поведение (например, идемпотентность MarkUsed) удобнее задавать явно.

type fakeUsers struct {
	mu       sync.Mutex
	byID     map[uuid.UUID]*domain.SuperAdminUser
	failNext error
}

func newFakeUsers() *fakeUsers {
	return &fakeUsers{byID: make(map[uuid.UUID]*domain.SuperAdminUser)}
}

func (f *fakeUsers) add(u *domain.SuperAdminUser) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.byID[u.ID] = u
}

func clone(u *domain.SuperAdminUser) *domain.SuperAdminUser {
	c := *u
	return &c
}

func (f *fakeUsers) Create(_ context.Context, u *domain.SuperAdminUser) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.byID[u.ID] = clone(u)
	return nil
}

func (f *fakeUsers) GetByID(_ context.Context, id uuid.UUID) (*domain.SuperAdminUser, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	u, ok := f.byID[id]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return clone(u), nil
}

func (f *fakeUsers) GetByEmail(_ context.Context, email string) (*domain.SuperAdminUser, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.failNext != nil {
		err := f.failNext
		f.failNext = nil
		return nil, err
	}
	for _, u := range f.byID {
		if equalFold(u.Email, email) {
			return clone(u), nil
		}
	}
	return nil, domain.ErrNotFound
}

func (f *fakeUsers) List(_ context.Context) ([]domain.SuperAdminUser, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]domain.SuperAdminUser, 0, len(f.byID))
	for _, u := range f.byID {
		out = append(out, *u)
	}
	return out, nil
}

func (f *fakeUsers) RegisterFailedLogin(_ context.Context, id uuid.UUID, lockedUntil *time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	u, ok := f.byID[id]
	if !ok {
		return domain.ErrNotFound
	}
	u.FailedLoginAttempts++
	if lockedUntil != nil {
		u.LockedUntil = lockedUntil
	}
	return nil
}

func (f *fakeUsers) RegisterSuccessfulLogin(_ context.Context, id uuid.UUID, at time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	u, ok := f.byID[id]
	if !ok {
		return domain.ErrNotFound
	}
	u.FailedLoginAttempts = 0
	u.LockedUntil = nil
	u.LastLoginAt = &at
	return nil
}

func (f *fakeUsers) UpdateRole(_ context.Context, id uuid.UUID, role domain.Role) (*domain.SuperAdminUser, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	u, ok := f.byID[id]
	if !ok {
		return nil, domain.ErrNotFound
	}
	u.Role = role
	return clone(u), nil
}

func (f *fakeUsers) UpdateStatus(_ context.Context, id uuid.UUID, status domain.UserStatus) (*domain.SuperAdminUser, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	u, ok := f.byID[id]
	if !ok {
		return nil, domain.ErrNotFound
	}
	u.Status = status
	return clone(u), nil
}

func equalFold(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		ca, cb := a[i], b[i]
		if 'A' <= ca && ca <= 'Z' {
			ca += 'a' - 'A'
		}
		if 'A' <= cb && cb <= 'Z' {
			cb += 'a' - 'A'
		}
		if ca != cb {
			return false
		}
	}
	return true
}

type fakeTokens struct {
	mu     sync.Mutex
	byID   map[uuid.UUID]*domain.RefreshToken
	byHash map[string]uuid.UUID
}

func newFakeTokens() *fakeTokens {
	return &fakeTokens{
		byID:   make(map[uuid.UUID]*domain.RefreshToken),
		byHash: make(map[string]uuid.UUID),
	}
}

func (f *fakeTokens) Create(_ context.Context, t *domain.RefreshToken) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	c := *t
	f.byID[t.ID] = &c
	f.byHash[string(t.TokenHash)] = t.ID
	return nil
}

func (f *fakeTokens) GetByHash(_ context.Context, hash []byte) (*domain.RefreshToken, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	id, ok := f.byHash[string(hash)]
	if !ok {
		return nil, domain.ErrNotFound
	}
	c := *f.byID[id]
	return &c, nil
}

// MarkUsed идемпотентен так же, как SQL-запрос с условием used_at IS NULL.
func (f *fakeTokens) MarkUsed(_ context.Context, id, replacedBy uuid.UUID, at time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	t, ok := f.byID[id]
	if !ok {
		return domain.ErrNotFound
	}
	if t.UsedAt != nil {
		return nil
	}
	t.UsedAt = &at
	t.ReplacedBy = &replacedBy
	return nil
}

func (f *fakeTokens) RevokeSession(_ context.Context, sessionID uuid.UUID, reason string, at time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, t := range f.byID {
		if t.SessionID == sessionID && t.RevokedAt == nil {
			t.RevokedAt = &at
			t.RevokedReason = reason
		}
	}
	return nil
}

func (f *fakeTokens) RevokeAllForUser(_ context.Context, userID uuid.UUID, reason string, at time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, t := range f.byID {
		if t.UserID == userID && t.RevokedAt == nil {
			t.RevokedAt = &at
			t.RevokedReason = reason
		}
	}
	return nil
}

func (f *fakeTokens) DeleteExpired(_ context.Context, before time.Time) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var n int64
	for id, t := range f.byID {
		if t.ExpiresAt.Before(before) {
			delete(f.byHash, string(t.TokenHash))
			delete(f.byID, id)
			n++
		}
	}
	return n, nil
}

func (f *fakeTokens) all() []domain.RefreshToken {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]domain.RefreshToken, 0, len(f.byID))
	for _, t := range f.byID {
		out = append(out, *t)
	}
	return out
}

type fakeRevoker struct {
	mu      sync.Mutex
	revoked map[uuid.UUID]time.Duration
}

func newFakeRevoker() *fakeRevoker {
	return &fakeRevoker{revoked: make(map[uuid.UUID]time.Duration)}
}

func (f *fakeRevoker) Revoke(_ context.Context, tokenID uuid.UUID, ttl time.Duration) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.revoked[tokenID] = ttl
	return nil
}

func (f *fakeRevoker) IsRevoked(_ context.Context, tokenID uuid.UUID) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	_, ok := f.revoked[tokenID]
	return ok, nil
}

type fakeAudit struct {
	mu      sync.Mutex
	entries []domain.AuditEntry
}

func (f *fakeAudit) Write(_ context.Context, e domain.AuditEntry) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.entries = append(f.entries, e)
	return nil
}

func (f *fakeAudit) List(context.Context, domain.AuditFilter) ([]domain.AuditEntry, int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]domain.AuditEntry(nil), f.entries...), int64(len(f.entries)), nil
}

func (f *fakeAudit) actions() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]string, 0, len(f.entries))
	for _, e := range f.entries {
		out = append(out, e.Action)
	}
	return out
}

type fakeInvitations struct {
	mu      sync.Mutex
	pending map[string]bool
	created []domain.Invitation
}

func newFakeInvitations() *fakeInvitations {
	return &fakeInvitations{pending: make(map[string]bool)}
}

func (f *fakeInvitations) Create(_ context.Context, inv *domain.Invitation) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	inv.ID = uuid.New()
	inv.CreatedAt = time.Now()
	f.pending[inv.Email] = true
	f.created = append(f.created, *inv)
	return nil
}

func (f *fakeInvitations) HasPending(_ context.Context, email string) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.pending[email], nil
}

// testClock — управляемое время: тесты на протухание не должны ждать реальных TTL.
type testClock struct {
	mu  sync.Mutex
	now time.Time
}

func newTestClock(t time.Time) *testClock { return &testClock{now: t} }

func (c *testClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *testClock) advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(d)
}
