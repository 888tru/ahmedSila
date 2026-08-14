// Package postgres — реализация репозиториев domain поверх sqlc и pgx.
//
// Только этот пакет знает про SQL и pgx. Наружу он отдаёт доменные типы
// и доменные ошибки: usecase не должен разбираться, что такое pgconn.PgError.
package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/ahmedsila/superadmin/internal/domain"
)

type PoolConfig struct {
	URL      string
	MaxConns int32
}

// NewPool подключается и сразу проверяет соединение: падать на старте
// лучше, чем на первом запросе пользователя.
func NewPool(ctx context.Context, cfg PoolConfig) (*pgxpool.Pool, error) {
	poolCfg, err := pgxpool.ParseConfig(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("разбор DATABASE_URL: %w", err)
	}
	if cfg.MaxConns > 0 {
		poolCfg.MaxConns = cfg.MaxConns
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("создание пула соединений: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("подключение к PostgreSQL: %w", err)
	}
	return pool, nil
}

// Коды ошибок PostgreSQL, которые имеют доменный смысл.
const (
	pgUniqueViolation     = "23505"
	pgForeignKeyViolation = "23503"
)

// mapError переводит ошибки драйвера в доменные.
// Единственное место, где это делается: иначе errors.Is(err, ErrNotFound)
// в usecase работал бы через раз.
func mapError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNotFound
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case pgUniqueViolation:
			return fmt.Errorf("%w: %s", domain.ErrConflict, pgErr.ConstraintName)
		case pgForeignKeyViolation:
			return fmt.Errorf("%w: %s", domain.ErrNotFound, pgErr.ConstraintName)
		}
	}
	return err
}
