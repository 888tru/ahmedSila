# Суперадминка

Внутренняя панель управления тенантами (магазинами и супермаркетами).
Архитектура и обоснование решений — в [`TECH_STACK.md`](./TECH_STACK.md).

## Требования

- Go 1.26+
- Node.js 22+
- Docker (для Postgres, Redis и интеграционных тестов на testcontainers)
- [go-task](https://taskfile.dev): `go install github.com/go-task/task/v3/cmd/task@latest`

Остальной тулинг:

```
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
go install github.com/pressly/goose/v3/cmd/goose@latest
go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest
```

## Первый запуск

```
cp .env.example .env
task gen-keys        # вставить полученные ключи в .env
task up              # Postgres + Redis (нужен запущенный Docker Desktop)
task migrate-up
task run             # http://localhost:8080/healthz
```

## Текущее состояние

Готов скелет: тулчейн, миграция `0001`, слой domain с портами, auth-usecase
с ротацией refresh-токенов, репозитории на sqlc, HTTP-слой и точка входа.

Не сделано (следующий шаг): `cmd/seed` для первого owner'а, интеграционные
тесты репозиториев на testcontainers, эндпоинты тенантов.

Фронтенд (`web/`) — пустой шаблон Vite, работа над ним начнётся после бэкенда.

## Полезные команды

| Команда | Что делает |
|---|---|
| `task` | список всех задач |
| `task test` | все тесты, включая интеграционные (нужен Docker) |
| `task test-unit` | только быстрые тесты, без Docker |
| `task lint` | golangci-lint |
| `task migrate-new -- add_something` | новая миграция |
| `task sqlc` | перегенерировать код доступа к БД после правки запросов |
| `task reset` | снести контейнеры вместе с данными |

## Структура

```
cmd/server        точка входа
cmd/seed          создание первого owner'а
cmd/genkeys       генерация Ed25519-ключей для JWT
internal/domain   сущности и интерфейсы, без внешних зависимостей
internal/usecase  бизнес-логика поверх интерфейсов domain
internal/repository/postgres  реализация репозиториев (queries/ — SQL для sqlc)
internal/delivery/http        Gin: хендлеры, middleware, роутинг
internal/pkg      jwt, authz, config, redis, hash
migrations        SQL-миграции (goose)
web               фронтенд (Vite + React + TS)
```

Правило зависимостей: `delivery → usecase → domain ← repository`.
`domain` не импортирует ни Gin, ни sqlc, ни Redis.
