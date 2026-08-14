// Команда server — точка входа суперадминки.
//
// Здесь и только здесь собирается граф зависимостей: конкретные реализации
// подставляются в интерфейсы domain. Заменить PasswordAuthProvider на SSO
// или табличный Authorizer на Casbin — это правка этого файла, а не usecase.
package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rs/zerolog"

	delivery "github.com/ahmedsila/superadmin/internal/delivery/http"
	"github.com/ahmedsila/superadmin/internal/delivery/http/handler"
	"github.com/ahmedsila/superadmin/internal/domain"
	"github.com/ahmedsila/superadmin/internal/pkg/authprovider"
	"github.com/ahmedsila/superadmin/internal/pkg/authz"
	"github.com/ahmedsila/superadmin/internal/pkg/config"
	"github.com/ahmedsila/superadmin/internal/pkg/hash"
	"github.com/ahmedsila/superadmin/internal/pkg/jwt"
	"github.com/ahmedsila/superadmin/internal/pkg/redisx"
	"github.com/ahmedsila/superadmin/internal/repository/postgres"
	"github.com/ahmedsila/superadmin/internal/usecase"
)

func main() {
	if err := run(); err != nil {
		// Логгер может быть ещё не поднят — пишем в stderr напрямую
		fallback := zerolog.New(os.Stderr).With().Timestamp().Logger()
		fallback.Error().Err(err).Msg("startup_failed")
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	log := newLogger(cfg)

	// Контекст завершения: SIGINT/SIGTERM останавливают сервер аккуратно
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := postgres.NewPool(ctx, postgres.PoolConfig{
		URL:      cfg.DB.URL,
		MaxConns: cfg.DB.MaxConns,
	})
	if err != nil {
		return err
	}
	defer pool.Close()

	redisClient, err := redisx.NewClient(ctx, redisx.Options{
		Addr:     cfg.Redis.Addr,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})
	if err != nil {
		return err
	}
	defer func() { _ = redisClient.Close() }()

	issuer, err := jwt.New(jwt.Config{
		PrivateKeyBase64: cfg.JWT.PrivateKey,
		PublicKeyBase64:  cfg.JWT.PublicKey,
		KeyID:            cfg.JWT.KeyID,
		Issuer:           cfg.JWT.Issuer,
	})
	if err != nil {
		return err
	}

	// --- сборка зависимостей ---
	users := postgres.NewSuperAdminRepo(pool)
	tokens := postgres.NewRefreshTokenRepo(pool)
	audit := postgres.NewAuditRepo(pool, log)
	revoker := redisx.NewRevoker(redisClient)
	hasher := hash.NewArgon2(hash.DefaultParams())
	authorizer := authz.New()

	authUC := usecase.NewAuth(
		authprovider.NewPassword(users, hasher),
		users, tokens, revoker, issuer, audit, domain.SystemClock{},
		usecase.AuthConfig{
			AccessTTL:  cfg.JWT.AccessTTL,
			RefreshTTL: cfg.JWT.RefreshTTL,
		},
	)

	router := delivery.NewRouter(delivery.RouterDeps{
		Logger:         log,
		AllowedOrigins: cfg.HTTP.AllowedOrigins,
		Issuer:         issuer,
		Revoker:        revoker,
		Authorizer:     authorizer,
		AuthHandler: handler.NewAuth(
			authUC,
			authorizer,
			// Secure-cookie только по HTTPS: в dev это выключено, иначе
			// браузер не сохранит cookie с localhost
			handler.DefaultCookieConfig(cfg.App.IsProd(), cfg.JWT.RefreshTTL),
		),
		IsProd: cfg.App.IsProd(),
	})

	srv := &http.Server{
		Addr:         cfg.HTTP.Addr,
		Handler:      router,
		ReadTimeout:  cfg.HTTP.ReadTimeout,
		WriteTimeout: cfg.HTTP.WriteTimeout,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Info().Str("addr", cfg.HTTP.Addr).Str("env", cfg.App.Env).Msg("server_started")
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		log.Info().Msg("shutdown_started")
	}

	// Даём доработать текущим запросам, но не бесконечно
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		return err
	}
	log.Info().Msg("shutdown_complete")
	return nil
}

func newLogger(cfg *config.Config) zerolog.Logger {
	level, err := zerolog.ParseLevel(cfg.App.LogLevel)
	if err != nil {
		level = zerolog.InfoLevel
	}

	// В проде — JSON для сбора логов, локально — человекочитаемый вывод
	var writer = os.Stdout
	logger := zerolog.New(writer).Level(level).With().Timestamp().Logger()
	if !cfg.App.IsProd() {
		logger = logger.Output(zerolog.ConsoleWriter{Out: writer, TimeFormat: time.RFC3339})
	}
	return logger
}
