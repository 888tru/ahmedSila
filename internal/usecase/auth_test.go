package usecase_test

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/ahmedsila/superadmin/internal/domain"
	"github.com/ahmedsila/superadmin/internal/pkg/authprovider"
	"github.com/ahmedsila/superadmin/internal/pkg/hash"
	"github.com/ahmedsila/superadmin/internal/pkg/jwt"
	"github.com/ahmedsila/superadmin/internal/usecase"
)

const (
	testEmail    = "owner@example.com"
	testPassword = "correct-horse-battery"
)

type fixture struct {
	auth    *usecase.Auth
	users   *fakeUsers
	tokens  *fakeTokens
	revoker *fakeRevoker
	audit   *fakeAudit
	clock   *testClock
	issuer  *jwt.Issuer
	user    *domain.SuperAdminUser
}

func newFixture(t *testing.T) *fixture {
	t.Helper()

	clock := newTestClock(time.Date(2026, 8, 13, 12, 0, 0, 0, time.UTC))

	priv, pub, err := jwt.GenerateKeyPair()
	if err != nil {
		t.Fatalf("генерация ключей: %v", err)
	}
	issuer, err := jwt.New(jwt.Config{
		PrivateKeyBase64: priv,
		PublicKeyBase64:  pub,
		KeyID:            "test-1",
		Issuer:           "superadmin-test",
		Clock:            clock,
	})
	if err != nil {
		t.Fatalf("создание issuer: %v", err)
	}

	// TestParams вместо боевых: иначе каждый тест с логином жуёт 19 МБ
	hasher := hash.NewArgon2(hash.TestParams())
	pwHash, err := hasher.Hash(testPassword)
	if err != nil {
		t.Fatalf("хеширование пароля: %v", err)
	}

	user := &domain.SuperAdminUser{
		ID:           uuid.New(),
		Email:        testEmail,
		FullName:     "Owner",
		PasswordHash: pwHash,
		Role:         domain.RoleOwner,
		Status:       domain.UserStatusActive,
		CreatedAt:    clock.Now(),
		UpdatedAt:    clock.Now(),
	}

	users := newFakeUsers()
	users.add(user)
	tokens := newFakeTokens()
	revoker := newFakeRevoker()
	audit := &fakeAudit{}

	auth := usecase.NewAuth(
		authprovider.NewPassword(users, hasher),
		users, tokens, revoker, issuer, audit, clock,
		usecase.AuthConfig{
			AccessTTL:         15 * time.Minute,
			RefreshTTL:        720 * time.Hour,
			MaxFailedAttempts: 3,
			LockoutDuration:   15 * time.Minute,
		},
	)

	return &fixture{
		auth: auth, users: users, tokens: tokens, revoker: revoker,
		audit: audit, clock: clock, issuer: issuer, user: user,
	}
}

func reqCtx() domain.RequestContext {
	return domain.RequestContext{IP: "203.0.113.10", UserAgent: "test-agent"}
}

func creds(email, password string) domain.Credentials {
	return domain.Credentials{Email: email, Password: password}
}

func TestLogin_Success(t *testing.T) {
	f := newFixture(t)

	pair, user, err := f.auth.Login(context.Background(), creds(testEmail, testPassword), reqCtx())
	if err != nil {
		t.Fatalf("ожидался успешный логин, получено: %v", err)
	}
	if pair.AccessToken == "" || pair.RefreshToken == "" {
		t.Fatal("пустая пара токенов")
	}
	if user.ID != f.user.ID {
		t.Fatalf("вернулся не тот пользователь: %s", user.ID)
	}

	claims, err := f.issuer.Parse(pair.AccessToken)
	if err != nil {
		t.Fatalf("выданный токен не разбирается: %v", err)
	}
	if claims.UserID != f.user.ID || claims.Role != domain.RoleOwner {
		t.Fatalf("некорректные claims: %+v", claims)
	}
	if !claims.ExpiresAt.Equal(f.clock.Now().Add(15 * time.Minute)) {
		t.Fatalf("неожиданный срок жизни access-токена: %s", claims.ExpiresAt)
	}

	if !slices.Contains(f.audit.actions(), domain.AuditLoginSuccess) {
		t.Fatalf("в аудите нет записи об успешном входе: %v", f.audit.actions())
	}

	// Сам refresh-токен в хранилище лежать не должен — только его хеш
	for _, tok := range f.tokens.all() {
		if string(tok.TokenHash) == pair.RefreshToken {
			t.Fatal("refresh-токен сохранён в открытом виде")
		}
	}
}

func TestLogin_EmailIsCaseInsensitive(t *testing.T) {
	f := newFixture(t)

	if _, _, err := f.auth.Login(context.Background(), creds("OWNER@Example.COM ", testPassword), reqCtx()); err != nil {
		t.Fatalf("email должен сравниваться регистронезависимо, получено: %v", err)
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	f := newFixture(t)

	_, _, err := f.auth.Login(context.Background(), creds(testEmail, "wrong-password"), reqCtx())
	if !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Fatalf("ожидалась ErrInvalidCredentials, получено: %v", err)
	}

	stored, err := f.users.GetByID(context.Background(), f.user.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.FailedLoginAttempts != 1 {
		t.Fatalf("счётчик неудачных попыток = %d, ожидался 1", stored.FailedLoginAttempts)
	}
	if !slices.Contains(f.audit.actions(), domain.AuditLoginFailure) {
		t.Fatal("неудачный вход не попал в аудит")
	}
}

func TestLogin_UnknownEmail(t *testing.T) {
	f := newFixture(t)

	_, _, err := f.auth.Login(context.Background(), creds("nobody@example.com", testPassword), reqCtx())
	// Та же ошибка, что и при неверном пароле: эндпоинт не должен подсказывать,
	// существует ли учётка
	if !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Fatalf("ожидалась ErrInvalidCredentials, получено: %v", err)
	}
}

func TestLogin_LockoutAfterMaxAttempts(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		if _, _, err := f.auth.Login(ctx, creds(testEmail, "wrong"), reqCtx()); !errors.Is(err, domain.ErrInvalidCredentials) {
			t.Fatalf("попытка %d: ожидалась ErrInvalidCredentials, получено %v", i+1, err)
		}
	}

	// Даже с верным паролем вход закрыт до истечения блокировки
	_, _, err := f.auth.Login(ctx, creds(testEmail, testPassword), reqCtx())
	if !errors.Is(err, domain.ErrAccountLocked) {
		t.Fatalf("ожидалась ErrAccountLocked, получено: %v", err)
	}

	f.clock.advance(16 * time.Minute)
	if _, _, err := f.auth.Login(ctx, creds(testEmail, testPassword), reqCtx()); err != nil {
		t.Fatalf("после истечения блокировки вход должен пройти, получено: %v", err)
	}
}

func TestLogin_SuspendedUserLooksLikeWrongCredentials(t *testing.T) {
	f := newFixture(t)
	f.user.Status = domain.UserStatusSuspended

	_, _, err := f.auth.Login(context.Background(), creds(testEmail, testPassword), reqCtx())
	if !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Fatalf("статус учётки не должен раскрываться, получено: %v", err)
	}
}

func TestRefresh_RotatesToken(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()

	first, _, err := f.auth.Login(ctx, creds(testEmail, testPassword), reqCtx())
	if err != nil {
		t.Fatal(err)
	}

	f.clock.advance(time.Minute)
	second, err := f.auth.Refresh(ctx, first.RefreshToken, reqCtx())
	if err != nil {
		t.Fatalf("refresh не прошёл: %v", err)
	}
	if second.RefreshToken == first.RefreshToken {
		t.Fatal("refresh-токен не ротировался")
	}

	// Старый помечен использованным и связан с преемником
	var old, replacement *domain.RefreshToken
	for _, tok := range f.tokens.all() {
		t := tok
		if t.UsedAt != nil {
			old = &t
		} else {
			replacement = &t
		}
	}
	if old == nil || replacement == nil {
		t.Fatal("в хранилище должны быть использованный и новый токены")
	}
	if old.ReplacedBy == nil || *old.ReplacedBy != replacement.ID {
		t.Fatal("старый токен не связан с преемником через replaced_by")
	}
	if old.SessionID != replacement.SessionID {
		t.Fatal("ротация должна сохранять цепочку сессии")
	}
}

func TestRefresh_ReuseRevokesWholeSession(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()

	first, _, err := f.auth.Login(ctx, creds(testEmail, testPassword), reqCtx())
	if err != nil {
		t.Fatal(err)
	}
	second, err := f.auth.Refresh(ctx, first.RefreshToken, reqCtx())
	if err != nil {
		t.Fatal(err)
	}

	// Повторное предъявление уже использованного токена = признак утечки
	if _, err := f.auth.Refresh(ctx, first.RefreshToken, reqCtx()); !errors.Is(err, domain.ErrSessionRevoked) {
		t.Fatalf("ожидалась ErrSessionRevoked, получено: %v", err)
	}

	// И «честный» токен той же цепочки тоже перестаёт работать
	if _, err := f.auth.Refresh(ctx, second.RefreshToken, reqCtx()); !errors.Is(err, domain.ErrSessionRevoked) {
		t.Fatalf("вся сессия должна быть отозвана, получено: %v", err)
	}

	if !slices.Contains(f.audit.actions(), domain.AuditTokenReuse) {
		t.Fatal("факт переиспользования не попал в аудит")
	}
}

func TestRefresh_ExpiredToken(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()

	pair, _, err := f.auth.Login(ctx, creds(testEmail, testPassword), reqCtx())
	if err != nil {
		t.Fatal(err)
	}

	f.clock.advance(721 * time.Hour)
	if _, err := f.auth.Refresh(ctx, pair.RefreshToken, reqCtx()); !errors.Is(err, domain.ErrUnauthenticated) {
		t.Fatalf("ожидалась ErrUnauthenticated, получено: %v", err)
	}
}

func TestRefresh_UnknownToken(t *testing.T) {
	f := newFixture(t)

	if _, err := f.auth.Refresh(context.Background(), "не-выдававшийся-токен", reqCtx()); !errors.Is(err, domain.ErrUnauthenticated) {
		t.Fatalf("ожидалась ErrUnauthenticated, получено: %v", err)
	}
}

func TestRefresh_SuspendedUserLosesSession(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()

	pair, _, err := f.auth.Login(ctx, creds(testEmail, testPassword), reqCtx())
	if err != nil {
		t.Fatal(err)
	}

	// Учётку отключили посреди активной сессии
	stored, _ := f.users.GetByID(ctx, f.user.ID)
	stored.Status = domain.UserStatusSuspended
	f.users.add(stored)

	if _, err := f.auth.Refresh(ctx, pair.RefreshToken, reqCtx()); !errors.Is(err, domain.ErrUnauthenticated) {
		t.Fatalf("ожидалась ErrUnauthenticated, получено: %v", err)
	}
	for _, tok := range f.tokens.all() {
		if tok.RevokedAt == nil {
			t.Fatal("сессия отключённого пользователя должна быть отозвана")
		}
	}
}

func TestLogout_RevokesSessionAndAccessToken(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()

	pair, _, err := f.auth.Login(ctx, creds(testEmail, testPassword), reqCtx())
	if err != nil {
		t.Fatal(err)
	}
	claims, err := f.issuer.Parse(pair.AccessToken)
	if err != nil {
		t.Fatal(err)
	}

	if err := f.auth.Logout(ctx, pair.RefreshToken, claims, reqCtx()); err != nil {
		t.Fatalf("logout: %v", err)
	}

	// jti access-токена — в revocation list, с TTL не больше остатка его жизни
	revoked, err := f.revoker.IsRevoked(ctx, claims.TokenID)
	if err != nil {
		t.Fatal(err)
	}
	if !revoked {
		t.Fatal("access-токен не попал в revocation list")
	}
	if ttl := f.revoker.revoked[claims.TokenID]; ttl > 15*time.Minute {
		t.Fatalf("TTL записи об отзыве больше жизни токена: %s", ttl)
	}

	// Refresh после logout не работает
	if _, err := f.auth.Refresh(ctx, pair.RefreshToken, reqCtx()); !errors.Is(err, domain.ErrSessionRevoked) {
		t.Fatalf("ожидалась ErrSessionRevoked, получено: %v", err)
	}
}

func TestLogoutAll_RevokesEverySession(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()

	firstDevice, _, err := f.auth.Login(ctx, creds(testEmail, testPassword), reqCtx())
	if err != nil {
		t.Fatal(err)
	}
	secondDevice, _, err := f.auth.Login(ctx, creds(testEmail, testPassword), reqCtx())
	if err != nil {
		t.Fatal(err)
	}

	if err := f.auth.LogoutAll(ctx, f.user.ID, nil, reqCtx()); err != nil {
		t.Fatalf("logout all: %v", err)
	}

	for _, token := range []string{firstDevice.RefreshToken, secondDevice.RefreshToken} {
		if _, err := f.auth.Refresh(ctx, token, reqCtx()); !errors.Is(err, domain.ErrSessionRevoked) {
			t.Fatalf("сессия должна быть отозвана, получено: %v", err)
		}
	}
}

func TestLogin_StartsSeparateSessionPerDevice(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()

	first, _, err := f.auth.Login(ctx, creds(testEmail, testPassword), reqCtx())
	if err != nil {
		t.Fatal(err)
	}
	second, _, err := f.auth.Login(ctx, creds(testEmail, testPassword), reqCtx())
	if err != nil {
		t.Fatal(err)
	}

	firstClaims, _ := f.issuer.Parse(first.AccessToken)
	secondClaims, _ := f.issuer.Parse(second.AccessToken)
	if firstClaims.SessionID == secondClaims.SessionID {
		t.Fatal("каждый вход должен начинать свою цепочку ротации")
	}

	// Выход на одном устройстве не должен ронять сессию на другом
	if err := f.auth.Logout(ctx, first.RefreshToken, firstClaims, reqCtx()); err != nil {
		t.Fatal(err)
	}
	if _, err := f.auth.Refresh(ctx, second.RefreshToken, reqCtx()); err != nil {
		t.Fatalf("вторая сессия должна остаться живой, получено: %v", err)
	}
}
