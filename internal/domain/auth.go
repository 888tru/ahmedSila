package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Credentials — то, что предъявляет пользователь при входе.
type Credentials struct {
	Email    string
	Password string
}

// AuthProvider — способ аутентификации. В MVP реализация одна (пароль),
// SSO/OIDC позже добавляется второй реализацией: usecase не меняется
// (TECH_STACK.md §2, «расширяемость через дизайн»).
type AuthProvider interface {
	// Name — идентификатор провайдера для аудита ("password", "oidc:okta", ...).
	Name() string

	// Authenticate возвращает ErrInvalidCredentials, если проверка не прошла.
	//
	// Важно: при неверном пароле известного пользователя возвращается
	// (user, ErrInvalidCredentials) — пользователь нужен вызывающему, чтобы
	// увеличить счётчик неудачных попыток. При неизвестном email — (nil, ErrInvalidCredentials),
	// и внешне эти два случая неразличимы: ни по тексту ошибки, ни по времени ответа.
	Authenticate(ctx context.Context, c Credentials) (*SuperAdminUser, error)
}

// PasswordHasher — argon2id в MVP. Отдельный порт, чтобы тесты не молотили
// килобайты памяти на каждый хеш.
type PasswordHasher interface {
	Hash(plain string) (string, error)
	// Verify возвращает false без ошибки на неверный пароль; ошибка — только
	// на битый или неизвестный формат хеша.
	Verify(plain, encodedHash string) (bool, error)
	// DummyVerify тратит столько же времени, сколько настоящая проверка.
	// Вызывается для несуществующих пользователей: без этого разница во времени
	// ответа превращает login в оракул существования учёток.
	DummyVerify()
}

// AccessClaims — полезная нагрузка access-токена.
type AccessClaims struct {
	UserID    uuid.UUID
	Email     string
	Role      Role
	SessionID uuid.UUID
	TokenID   uuid.UUID // jti, он же ключ в revocation list
	IssuedAt  time.Time
	ExpiresAt time.Time
}

// TokenIssuer — выпуск и разбор access-токенов.
// Реализация в MVP — Ed25519 (асимметрия с самого начала, чтобы контур
// тенантов позже смог проверять подпись по публичному ключу через JWKS).
type TokenIssuer interface {
	Issue(claims AccessClaims) (string, error)
	// Parse проверяет подпись и срок; отзыв проверяется отдельно, через TokenRevoker.
	Parse(token string) (*AccessClaims, error)
}

// TokenPair — то, что получает клиент после логина или refresh.
type TokenPair struct {
	AccessToken      string
	AccessExpiresAt  time.Time
	RefreshToken     string
	RefreshExpiresAt time.Time
}

// RequestContext — то, что известно о запросе и попадает в аудит.
type RequestContext struct {
	IP        string
	UserAgent string
}

// Clock — время как зависимость: тесты на протухание токенов не должны
// зависеть от реальных часов.
type Clock interface {
	Now() time.Time
}

type SystemClock struct{}

func (SystemClock) Now() time.Time { return time.Now().UTC() }
