// Package jwt — выпуск и разбор access-токенов на Ed25519 (алгоритм EdDSA).
//
// Асимметрия выбрана с самого начала осознанно: контур тенантов (TECH_STACK.md §1)
// потребует, чтобы целевой сервис проверял подпись по публичному ключу через JWKS,
// не имея приватного. С HS256 это позже означало бы смену схемы подписи.
package jwt

import (
	"crypto/ed25519"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	jwtlib "github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/ahmedsila/superadmin/internal/domain"
)

var (
	ErrInvalidToken = errors.New("некорректный токен")
	ErrKeyMismatch  = errors.New("токен подписан неизвестным ключом")
)

type claims struct {
	Email     string `json:"email"`
	Role      string `json:"role"`
	SessionID string `json:"sid"`
	jwtlib.RegisteredClaims
}

// Issuer реализует domain.TokenIssuer.
type Issuer struct {
	private ed25519.PrivateKey
	public  ed25519.PublicKey
	keyID   string
	issuer  string
	clock   domain.Clock
}

var _ domain.TokenIssuer = (*Issuer)(nil)

type Config struct {
	PrivateKeyBase64 string
	PublicKeyBase64  string
	KeyID            string
	Issuer           string
	// Clock — источник времени для проверки срока годности.
	// Не задан — системные часы. Тесты подставляют управляемые: иначе проверка
	// exp зависит от реального времени, а выпуск токена — от времени usecase.
	Clock domain.Clock
}

func New(cfg Config) (*Issuer, error) {
	priv, err := base64.StdEncoding.DecodeString(cfg.PrivateKeyBase64)
	if err != nil {
		return nil, fmt.Errorf("декодирование приватного ключа: %w", err)
	}
	if len(priv) != ed25519.PrivateKeySize {
		return nil, fmt.Errorf("приватный ключ: ожидалось %d байт, получено %d", ed25519.PrivateKeySize, len(priv))
	}

	pub, err := base64.StdEncoding.DecodeString(cfg.PublicKeyBase64)
	if err != nil {
		return nil, fmt.Errorf("декодирование публичного ключа: %w", err)
	}
	if len(pub) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("публичный ключ: ожидалось %d байт, получено %d", ed25519.PublicKeySize, len(pub))
	}

	if cfg.KeyID == "" {
		return nil, errors.New("не задан идентификатор ключа (kid)")
	}

	clock := cfg.Clock
	if clock == nil {
		clock = domain.SystemClock{}
	}

	return &Issuer{
		private: ed25519.PrivateKey(priv),
		public:  ed25519.PublicKey(pub),
		keyID:   cfg.KeyID,
		issuer:  cfg.Issuer,
		clock:   clock,
	}, nil
}

// GenerateKeyPair — для cmd/genkeys и тестов.
func GenerateKeyPair() (privateB64, publicB64 string, err error) {
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		return "", "", err
	}
	return base64.StdEncoding.EncodeToString(priv), base64.StdEncoding.EncodeToString(pub), nil
}

func (i *Issuer) Issue(c domain.AccessClaims) (string, error) {
	tok := jwtlib.NewWithClaims(jwtlib.SigningMethodEdDSA, claims{
		Email:     c.Email,
		Role:      string(c.Role),
		SessionID: c.SessionID.String(),
		RegisteredClaims: jwtlib.RegisteredClaims{
			Issuer:    i.issuer,
			Subject:   c.UserID.String(),
			ID:        c.TokenID.String(),
			IssuedAt:  jwtlib.NewNumericDate(c.IssuedAt),
			ExpiresAt: jwtlib.NewNumericDate(c.ExpiresAt),
		},
	})
	// kid понадобится при ротации ключей и для JWKS: получатель должен знать,
	// каким из опубликованных ключей проверять подпись.
	tok.Header["kid"] = i.keyID

	signed, err := tok.SignedString(i.private)
	if err != nil {
		return "", fmt.Errorf("подпись токена: %w", err)
	}
	return signed, nil
}

// Parse проверяет подпись, срок и issuer. Отзыв токена здесь не проверяется —
// это отдельная ответственность domain.TokenRevoker (Redis).
func (i *Issuer) Parse(token string) (*domain.AccessClaims, error) {
	var c claims

	_, err := jwtlib.ParseWithClaims(token, &c, func(t *jwtlib.Token) (any, error) {
		if _, ok := t.Method.(*jwtlib.SigningMethodEd25519); !ok {
			return nil, fmt.Errorf("%w: алгоритм %v", ErrKeyMismatch, t.Header["alg"])
		}
		if kid, ok := t.Header["kid"].(string); ok && kid != i.keyID {
			return nil, fmt.Errorf("%w: kid=%s", ErrKeyMismatch, kid)
		}
		return i.public, nil
	},
		jwtlib.WithValidMethods([]string{jwtlib.SigningMethodEdDSA.Alg()}),
		jwtlib.WithIssuer(i.issuer),
		jwtlib.WithExpirationRequired(),
		jwtlib.WithTimeFunc(i.clock.Now),
	)
	if err != nil {
		// Обе ошибки в цепочке: ErrInvalidToken — для errors.Is у вызывающего,
		// исходная — чтобы в логе была причина (истёк, чужая подпись, битый формат)
		return nil, fmt.Errorf("%w: %w", ErrInvalidToken, err)
	}

	userID, err := uuid.Parse(c.Subject)
	if err != nil {
		return nil, fmt.Errorf("%w: некорректный sub", ErrInvalidToken)
	}
	tokenID, err := uuid.Parse(c.ID)
	if err != nil {
		return nil, fmt.Errorf("%w: некорректный jti", ErrInvalidToken)
	}
	sessionID, err := uuid.Parse(c.SessionID)
	if err != nil {
		return nil, fmt.Errorf("%w: некорректный sid", ErrInvalidToken)
	}

	role := domain.Role(c.Role)
	if !role.Valid() {
		return nil, fmt.Errorf("%w: неизвестная роль %q", ErrInvalidToken, c.Role)
	}

	out := &domain.AccessClaims{
		UserID:    userID,
		Email:     c.Email,
		Role:      role,
		SessionID: sessionID,
		TokenID:   tokenID,
	}
	if c.IssuedAt != nil {
		out.IssuedAt = c.IssuedAt.Time
	}
	if c.ExpiresAt != nil {
		out.ExpiresAt = c.ExpiresAt.Time
	}
	return out, nil
}

// TimeUntilExpiry — сколько ещё жить токену. Используется как TTL записи
// в revocation list: держать отозванный jti дольше его собственной жизни бессмысленно.
func TimeUntilExpiry(c *domain.AccessClaims, now time.Time) time.Duration {
	d := c.ExpiresAt.Sub(now)
	if d < 0 {
		return 0
	}
	return d
}
