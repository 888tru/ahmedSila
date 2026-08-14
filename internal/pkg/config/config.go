// Package config — конфигурация приложения из переменных окружения.
//
// Никаких дефолтов для секретов и адресов внешних систем: если переменная
// не задана, приложение падает на старте с понятным сообщением, а не поднимается
// с localhost-подключением в проде.
package config

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	App   App
	HTTP  HTTP
	DB    DB
	Redis Redis
	JWT   JWT
}

type App struct {
	Env      string // dev | staging | prod
	LogLevel string
}

func (a App) IsProd() bool { return a.Env == "prod" }

type HTTP struct {
	Addr           string
	ReadTimeout    time.Duration
	WriteTimeout   time.Duration
	AllowedOrigins []string
}

type DB struct {
	URL      string
	MaxConns int32
}

type Redis struct {
	Addr     string
	Password string
	DB       int
}

type JWT struct {
	PrivateKey string
	PublicKey  string
	KeyID      string
	Issuer     string
	AccessTTL  time.Duration
	RefreshTTL time.Duration
}

// Load читает .env (если есть) и переменные окружения. Переменные окружения
// имеют приоритет над файлом — так деплой перекрывает локальные значения.
func Load() (*Config, error) {
	v := viper.New()
	v.SetConfigFile(".env")
	v.SetConfigType("env")
	v.AutomaticEnv()

	if err := v.ReadInConfig(); err != nil {
		var notFound viper.ConfigFileNotFoundError
		if !errors.As(err, &notFound) && !isFileNotFound(err) {
			return nil, fmt.Errorf("чтение .env: %w", err)
		}
	}

	v.SetDefault("APP_ENV", "dev")
	v.SetDefault("LOG_LEVEL", "info")
	v.SetDefault("HTTP_ADDR", ":8080")
	v.SetDefault("HTTP_READ_TIMEOUT", "10s")
	v.SetDefault("HTTP_WRITE_TIMEOUT", "15s")
	v.SetDefault("DATABASE_MAX_CONNS", 10)
	v.SetDefault("REDIS_DB", 0)
	v.SetDefault("JWT_ISSUER", "superadmin")
	v.SetDefault("ACCESS_TOKEN_TTL", "15m")
	v.SetDefault("REFRESH_TOKEN_TTL", "720h")

	cfg := &Config{
		App: App{
			Env:      v.GetString("APP_ENV"),
			LogLevel: v.GetString("LOG_LEVEL"),
		},
		HTTP: HTTP{
			Addr:           v.GetString("HTTP_ADDR"),
			ReadTimeout:    v.GetDuration("HTTP_READ_TIMEOUT"),
			WriteTimeout:   v.GetDuration("HTTP_WRITE_TIMEOUT"),
			AllowedOrigins: splitAndTrim(v.GetString("CORS_ALLOWED_ORIGINS")),
		},
		DB: DB{
			URL:      v.GetString("DATABASE_URL"),
			MaxConns: v.GetInt32("DATABASE_MAX_CONNS"),
		},
		Redis: Redis{
			Addr:     v.GetString("REDIS_ADDR"),
			Password: v.GetString("REDIS_PASSWORD"),
			DB:       v.GetInt("REDIS_DB"),
		},
		JWT: JWT{
			PrivateKey: v.GetString("JWT_PRIVATE_KEY"),
			PublicKey:  v.GetString("JWT_PUBLIC_KEY"),
			KeyID:      v.GetString("JWT_KEY_ID"),
			Issuer:     v.GetString("JWT_ISSUER"),
			AccessTTL:  v.GetDuration("ACCESS_TOKEN_TTL"),
			RefreshTTL: v.GetDuration("REFRESH_TOKEN_TTL"),
		},
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (c *Config) validate() error {
	var missing []string
	required := map[string]string{
		"DATABASE_URL":    c.DB.URL,
		"REDIS_ADDR":      c.Redis.Addr,
		"JWT_PRIVATE_KEY": c.JWT.PrivateKey,
		"JWT_PUBLIC_KEY":  c.JWT.PublicKey,
		"JWT_KEY_ID":      c.JWT.KeyID,
	}
	for name, value := range required {
		if strings.TrimSpace(value) == "" {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		return fmt.Errorf("не заданы обязательные переменные окружения: %s (см. .env.example)", strings.Join(missing, ", "))
	}

	if len(c.HTTP.AllowedOrigins) == 0 {
		return errors.New("не задан CORS_ALLOWED_ORIGINS: список origin'ов фронтенда обязателен")
	}
	for _, o := range c.HTTP.AllowedOrigins {
		if o == "*" {
			return errors.New("CORS_ALLOWED_ORIGINS=* запрещён: нужен явный whitelist (TECH_STACK.md §7)")
		}
	}

	switch c.App.Env {
	case "dev", "staging", "prod":
	default:
		return fmt.Errorf("APP_ENV=%q: допустимы dev, staging, prod", c.App.Env)
	}

	if c.JWT.AccessTTL <= 0 || c.JWT.RefreshTTL <= 0 {
		return errors.New("TTL токенов должны быть положительными")
	}
	if c.JWT.AccessTTL > time.Hour {
		return fmt.Errorf("ACCESS_TOKEN_TTL=%s слишком велик: короткий TTL — часть модели отзыва доступа", c.JWT.AccessTTL)
	}
	return nil
}

func splitAndTrim(s string) []string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// viper возвращает *fs.PathError, когда .env отсутствует и путь задан явно.
func isFileNotFound(err error) bool {
	return strings.Contains(err.Error(), "no such file") ||
		strings.Contains(err.Error(), "cannot find the file") ||
		strings.Contains(err.Error(), "система не может найти")
}
