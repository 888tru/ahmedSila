// Package redisx — клиент Redis и revocation list для access-токенов.
//
// Пакет назван redisx, чтобы не конфликтовать с импортом самой библиотеки.
package redisx

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"github.com/ahmedsila/superadmin/internal/domain"
)

type Options struct {
	Addr     string
	Password string
	DB       int
}

// NewClient подключается и сразу проверяет доступность: приложение не должно
// стартовать «условно рабочим», если Redis недоступен.
func NewClient(ctx context.Context, opts Options) (*redis.Client, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     opts.Addr,
		Password: opts.Password,
		DB:       opts.DB,
	})

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := client.Ping(pingCtx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("подключение к Redis %s: %w", opts.Addr, err)
	}
	return client, nil
}

const revokedKeyPrefix = "revoked:jti:"

// Revoker — revocation list по jti (domain.TokenRevoker).
//
// Записи живут ровно столько, сколько осталось жить самому токену: держать
// отозванный jti дольше бессмысленно, и список не растёт неограниченно.
type Revoker struct {
	client *redis.Client
}

var _ domain.TokenRevoker = (*Revoker)(nil)

func NewRevoker(client *redis.Client) *Revoker { return &Revoker{client: client} }

func key(tokenID uuid.UUID) string { return revokedKeyPrefix + tokenID.String() }

func (r *Revoker) Revoke(ctx context.Context, tokenID uuid.UUID, ttl time.Duration) error {
	if ttl <= 0 {
		// Токен уже протух — проверка подписи и так его не пропустит.
		return nil
	}
	if err := r.client.Set(ctx, key(tokenID), "1", ttl).Err(); err != nil {
		return fmt.Errorf("отзыв токена %s: %w", tokenID, err)
	}
	return nil
}

// IsRevoked — единственный сетевой поход на пути запроса с access-токеном.
//
// Ошибка Redis возвращается наверх, а не подавляется: политика поведения при
// недоступности Redis (fail-open или fail-closed) принимается в middleware,
// а не молча здесь.
func (r *Revoker) IsRevoked(ctx context.Context, tokenID uuid.UUID) (bool, error) {
	n, err := r.client.Exists(ctx, key(tokenID)).Result()
	if err != nil {
		return false, fmt.Errorf("проверка отзыва токена %s: %w", tokenID, err)
	}
	return n > 0, nil
}
