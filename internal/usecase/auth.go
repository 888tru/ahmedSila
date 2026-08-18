// Package usecase — бизнес-логика поверх интерфейсов domain.
// Здесь нет ни SQL, ни HTTP, ни Redis — только порты.
package usecase

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/ahmedsila/superadmin/internal/domain"
)

// AuthConfig — параметры политики входа.
type AuthConfig struct {
	AccessTTL         time.Duration
	RefreshTTL        time.Duration
	MaxFailedAttempts int
	LockoutDuration   time.Duration
}

func (c AuthConfig) withDefaults() AuthConfig {
	if c.MaxFailedAttempts <= 0 {
		c.MaxFailedAttempts = 5
	}
	if c.LockoutDuration <= 0 {
		c.LockoutDuration = 15 * time.Minute
	}
	return c
}

type Auth struct {
	provider domain.AuthProvider
	users    domain.SuperAdminRepository
	tokens   domain.RefreshTokenRepository
	revoker  domain.TokenRevoker
	issuer   domain.TokenIssuer
	audit    domain.AuditRepository
	clock    domain.Clock
	cfg      AuthConfig
}

func NewAuth(
	provider domain.AuthProvider,
	users domain.SuperAdminRepository,
	tokens domain.RefreshTokenRepository,
	revoker domain.TokenRevoker,
	issuer domain.TokenIssuer,
	audit domain.AuditRepository,
	clock domain.Clock,
	cfg AuthConfig,
) *Auth {
	return &Auth{
		provider: provider,
		users:    users,
		tokens:   tokens,
		revoker:  revoker,
		issuer:   issuer,
		audit:    audit,
		clock:    clock,
		cfg:      cfg.withDefaults(),
	}
}

// Login проверяет учётные данные и выдаёт пару токенов.
//
// Наружу отдаётся только ErrInvalidCredentials или ErrAccountLocked —
// по ответу нельзя понять, существует ли учётка.
func (a *Auth) Login(ctx context.Context, creds domain.Credentials, rc domain.RequestContext) (*domain.TokenPair, *domain.SuperAdminUser, error) {
	now := a.clock.Now()

	user, err := a.provider.Authenticate(ctx, creds)
	switch {
	case errors.Is(err, domain.ErrInvalidCredentials):
		if user != nil {
			if lockErr := a.registerFailure(ctx, user, now); lockErr != nil {
				return nil, nil, lockErr
			}
		}
		a.writeAudit(ctx, domain.AuditEntry{
			ActorEmail: creds.Email,
			Action:     domain.AuditLoginFailure,
			Metadata:   map[string]any{"provider": a.provider.Name(), "reason": "invalid_credentials"},
			IP:         rc.IP,
			UserAgent:  rc.UserAgent,
			CreatedAt:  now,
		})
		return nil, nil, domain.ErrInvalidCredentials
	case err != nil:
		return nil, nil, err
	}

	// Блокировка и статус проверяются после проверки пароля: иначе ответ
	// «заблокировано» выдаётся любому, кто просто угадал существующий email.
	if err := user.EnsureCanLogin(now); err != nil {
		a.writeAudit(ctx, domain.AuditEntry{
			ActorID:    &user.ID,
			ActorEmail: user.Email,
			Action:     domain.AuditLoginFailure,
			Metadata:   map[string]any{"provider": a.provider.Name(), "reason": errReason(err)},
			IP:         rc.IP,
			UserAgent:  rc.UserAgent,
			CreatedAt:  now,
		})
		return nil, nil, err
	}

	if err := a.users.RegisterSuccessfulLogin(ctx, user.ID, now); err != nil {
		return nil, nil, err
	}

	// Новый вход — новая цепочка ротации.
	pair, err := a.issuePair(ctx, user, uuid.New(), rc, now)
	if err != nil {
		return nil, nil, err
	}

	a.writeAudit(ctx, domain.AuditEntry{
		ActorID:    &user.ID,
		ActorEmail: user.Email,
		Action:     domain.AuditLoginSuccess,
		Metadata:   map[string]any{"provider": a.provider.Name()},
		IP:         rc.IP,
		UserAgent:  rc.UserAgent,
		CreatedAt:  now,
	})

	return pair, user, nil
}

// Refresh обменивает refresh-токен на новую пару, помечая старый использованным.
//
// Предъявление уже использованного или отозванного токена трактуется как утечка:
// отзывается вся цепочка ротации, а не только этот токен.
func (a *Auth) Refresh(ctx context.Context, refreshToken string, rc domain.RequestContext) (*domain.TokenPair, error) {
	now := a.clock.Now()

	stored, err := a.tokens.GetByHash(ctx, hashToken(refreshToken))
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.ErrUnauthenticated
		}
		return nil, err
	}

	if stored.IsUsed() || stored.IsRevoked() {
		if err := a.tokens.RevokeSession(ctx, stored.SessionID, domain.RevokeReasonReuse, now); err != nil {
			return nil, err
		}
		a.writeAudit(ctx, domain.AuditEntry{
			ActorID:   &stored.UserID,
			Action:    domain.AuditTokenReuse,
			Metadata:  map[string]any{"session_id": stored.SessionID.String(), "token_id": stored.ID.String()},
			IP:        rc.IP,
			UserAgent: rc.UserAgent,
			CreatedAt: now,
		})
		return nil, domain.ErrSessionRevoked
	}

	if stored.IsExpired(now) {
		return nil, domain.ErrUnauthenticated
	}

	user, err := a.users.GetByID(ctx, stored.UserID)
	if err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return nil, domain.ErrUnauthenticated
		}
		return nil, err
	}
	if err := user.EnsureCanLogin(now); err != nil {
		// Учётку отключили или заблокировали посреди активной сессии —
		// сессия больше не действует.
		if revokeErr := a.tokens.RevokeSession(ctx, stored.SessionID, domain.RevokeReasonUserDisabled, now); revokeErr != nil {
			return nil, revokeErr
		}
		return nil, domain.ErrUnauthenticated
	}

	// Сначала создаём преемника, потом помечаем старый использованным:
	// replaced_by ссылается на существующую запись.
	pair, err := a.issuePairWithID(ctx, user, stored.SessionID, rc, now)
	if err != nil {
		return nil, err
	}
	if err := a.tokens.MarkUsed(ctx, stored.ID, pair.refreshTokenID, now); err != nil {
		return nil, err
	}

	a.writeAudit(ctx, domain.AuditEntry{
		ActorID:    &user.ID,
		ActorEmail: user.Email,
		Action:     domain.AuditTokenRefresh,
		Metadata:   map[string]any{"session_id": stored.SessionID.String()},
		IP:         rc.IP,
		UserAgent:  rc.UserAgent,
		CreatedAt:  now,
	})

	return pair.TokenPair, nil
}

// Logout отзывает текущую сессию и кладёт jti access-токена в revocation list,
// чтобы он перестал приниматься, не дожидаясь истечения TTL.
func (a *Auth) Logout(ctx context.Context, refreshToken string, claims *domain.AccessClaims, rc domain.RequestContext) error {
	now := a.clock.Now()

	sessionID := uuid.Nil
	if claims != nil {
		sessionID = claims.SessionID
	}
	if refreshToken != "" {
		if stored, err := a.tokens.GetByHash(ctx, hashToken(refreshToken)); err == nil {
			sessionID = stored.SessionID
		} else if !errors.Is(err, domain.ErrNotFound) {
			return err
		}
	}

	if sessionID != uuid.Nil {
		if err := a.tokens.RevokeSession(ctx, sessionID, domain.RevokeReasonLogout, now); err != nil {
			return err
		}
	}

	if claims != nil {
		if ttl := claims.ExpiresAt.Sub(now); ttl > 0 {
			if err := a.revoker.Revoke(ctx, claims.TokenID, ttl); err != nil {
				return err
			}
		}
		a.writeAudit(ctx, domain.AuditEntry{
			ActorID:    &claims.UserID,
			ActorEmail: claims.Email,
			Action:     domain.AuditLogout,
			Metadata:   map[string]any{"session_id": sessionID.String()},
			IP:         rc.IP,
			UserAgent:  rc.UserAgent,
			CreatedAt:  now,
		})
	}

	return nil
}

// LogoutAll отзывает все сессии пользователя («выйти на всех устройствах»).
//
// Уже выданные access-токены живут не дольше AccessTTL; точечно гасить их все
// нельзя, не храня список активных jti, — поэтому здесь режутся refresh-токены,
// а access истекают сами в пределах 15 минут.
func (a *Auth) LogoutAll(ctx context.Context, userID uuid.UUID, actor *domain.AccessClaims, rc domain.RequestContext) error {
	now := a.clock.Now()

	if err := a.tokens.RevokeAllForUser(ctx, userID, domain.RevokeReasonLogoutAll, now); err != nil {
		return err
	}

	entry := domain.AuditEntry{
		Action:     domain.AuditSessionsRevoked,
		TargetType: string(domain.ResourceSuperAdmin),
		TargetID:   userID.String(),
		IP:         rc.IP,
		UserAgent:  rc.UserAgent,
		CreatedAt:  now,
	}
	if actor != nil {
		entry.ActorID = &actor.UserID
		entry.ActorEmail = actor.Email
	}
	a.writeAudit(ctx, entry)

	return nil
}

// Me возвращает актуального пользователя по claims — специально ходит в БД,
// а не доверяет содержимому токена: роль могли поменять после его выдачи.
func (a *Auth) Me(ctx context.Context, userID uuid.UUID) (*domain.SuperAdminUser, error) {
	return a.users.GetByID(ctx, userID)
}

// --- внутреннее ---

// issuedPair несёт id созданной refresh-записи, чтобы вызывающий мог связать
// её с предшественником через replaced_by.
type issuedPair struct {
	*domain.TokenPair
	refreshTokenID uuid.UUID
}

func (a *Auth) issuePair(ctx context.Context, user *domain.SuperAdminUser, sessionID uuid.UUID, rc domain.RequestContext, now time.Time) (*domain.TokenPair, error) {
	p, err := a.issuePairWithID(ctx, user, sessionID, rc, now)
	if err != nil {
		return nil, err
	}
	return p.TokenPair, nil
}

func (a *Auth) issuePairWithID(ctx context.Context, user *domain.SuperAdminUser, sessionID uuid.UUID, rc domain.RequestContext, now time.Time) (*issuedPair, error) {
	accessExp := now.Add(a.cfg.AccessTTL)
	accessTokenID := uuid.New()

	access, err := a.issuer.Issue(domain.AccessClaims{
		UserID:    user.ID,
		Email:     user.Email,
		Role:      user.Role,
		SessionID: sessionID,
		TokenID:   accessTokenID,
		IssuedAt:  now,
		ExpiresAt: accessExp,
	})
	if err != nil {
		return nil, err
	}

	rawRefresh, err := generateSecureToken()
	if err != nil {
		return nil, err
	}
	refreshExp := now.Add(a.cfg.RefreshTTL)
	record := &domain.RefreshToken{
		ID:        uuid.New(),
		UserID:    user.ID,
		SessionID: sessionID,
		TokenHash: hashToken(rawRefresh),
		ExpiresAt: refreshExp,
		UserAgent: rc.UserAgent,
		IP:        rc.IP,
		CreatedAt: now,
	}
	if err := a.tokens.Create(ctx, record); err != nil {
		return nil, err
	}

	return &issuedPair{
		TokenPair: &domain.TokenPair{
			AccessToken:      access,
			AccessExpiresAt:  accessExp,
			RefreshToken:     rawRefresh,
			RefreshExpiresAt: refreshExp,
		},
		refreshTokenID: record.ID,
	}, nil
}

// registerFailure увеличивает счётчик неудачных попыток и выставляет lockout,
// когда порог достигнут.
func (a *Auth) registerFailure(ctx context.Context, user *domain.SuperAdminUser, now time.Time) error {
	var lockedUntil *time.Time
	if user.FailedLoginAttempts+1 >= a.cfg.MaxFailedAttempts {
		t := now.Add(a.cfg.LockoutDuration)
		lockedUntil = &t
	}
	return a.users.RegisterFailedLogin(ctx, user.ID, lockedUntil)
}

// writeAudit намеренно игнорирует ошибку записи: журнал не должен ронять
// основную операцию. Реализация AuditRepository логирует такие ошибки сама.
func (a *Auth) writeAudit(ctx context.Context, e domain.AuditEntry) {
	_ = a.audit.Write(ctx, e)
}

func errReason(err error) string {
	switch {
	case errors.Is(err, domain.ErrAccountLocked):
		return "account_locked"
	case errors.Is(err, domain.ErrInvalidCredentials):
		return "invalid_credentials"
	default:
		return "unknown"
	}
}

// generateSecureToken — 32 байта из CSPRNG. Общий генератор для любых
// непрозрачных токенов (refresh, приглашение в команду): они проверяются
// только по хешу в БД, сам токен нигде не хранится.
func generateSecureToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("генерация токена: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// hashToken — в БД лежит SHA-256, а не сам токен: дамп таблицы не даёт
// возможности войти. Соль не нужна — токен и так 256 бит энтропии.
func hashToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}
