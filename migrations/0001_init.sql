-- +goose Up
-- +goose StatementBegin
CREATE EXTENSION IF NOT EXISTS citext;
-- +goose StatementEnd

-- Роли внутри команды суперадминки (TECH_STACK.md §1).
-- Новая роль добавляется миграцией, не рефакторингом.
-- +goose StatementBegin
CREATE TYPE super_admin_role AS ENUM ('owner', 'admin', 'support', 'viewer');
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TYPE super_admin_status AS ENUM ('active', 'suspended');
-- +goose StatementEnd

-- +goose StatementBegin
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE super_admin_users (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email                 citext NOT NULL UNIQUE,
    full_name             text NOT NULL DEFAULT '',
    -- argon2id, формат PHC-строки
    password_hash         text NOT NULL,
    role                  super_admin_role NOT NULL,
    status                super_admin_status NOT NULL DEFAULT 'active',
    -- TOTP: обязателен для owner/admin, включается на шаге 3
    totp_secret           text,
    totp_enrolled_at      timestamptz,
    -- Lockout после N неудачных попыток (§7)
    failed_login_attempts integer NOT NULL DEFAULT 0,
    locked_until          timestamptz,
    last_login_at         timestamptz,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TRIGGER super_admin_users_set_updated_at
    BEFORE UPDATE ON super_admin_users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- +goose StatementEnd

-- Refresh-токены. id — это jti из claims.
-- session_id связывает цепочку ротаций: при предъявлении уже использованного
-- токена отзывается вся сессия целиком (детект переиспользования, §7).
-- +goose StatementBegin
CREATE TABLE refresh_tokens (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES super_admin_users(id) ON DELETE CASCADE,
    session_id     uuid NOT NULL,
    -- Хранится SHA-256 от токена, не сам токен
    token_hash     bytea NOT NULL UNIQUE,
    expires_at     timestamptz NOT NULL,
    used_at        timestamptz,
    revoked_at     timestamptz,
    revoked_reason text,
    replaced_by    uuid REFERENCES refresh_tokens(id) ON DELETE SET NULL,
    user_agent     text NOT NULL DEFAULT '',
    -- text, а не inet: упрощает маппинг в sqlc; при появлении запросов
    -- по подсетям меняется миграцией
    ip             text NOT NULL DEFAULT '',
    created_at     timestamptz NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE INDEX refresh_tokens_session_id_idx ON refresh_tokens (session_id);
-- +goose StatementEnd

-- Для периодической чистки протухших токенов
-- +goose StatementBegin
CREATE INDEX refresh_tokens_expires_at_idx ON refresh_tokens (expires_at);
-- +goose StatementEnd

-- Аудит каждого действия с самого начала — доказательная база для будущего
-- SOC 2-аудита (§2). Пишется декоратором над usecase, не вручную в хендлерах.
-- +goose StatementBegin
CREATE TABLE audit_logs (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id    uuid REFERENCES super_admin_users(id) ON DELETE SET NULL,
    -- Денормализовано намеренно: запись аудита должна пережить удаление актора
    actor_email citext NOT NULL DEFAULT '',
    action      text NOT NULL,
    target_type text NOT NULL DEFAULT '',
    target_id   text NOT NULL DEFAULT '',
    metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
    ip          text NOT NULL DEFAULT '',
    user_agent  text NOT NULL DEFAULT '',
    created_at  timestamptz NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE INDEX audit_logs_created_at_idx ON audit_logs (created_at DESC);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE INDEX audit_logs_actor_id_idx ON audit_logs (actor_id, created_at DESC);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE INDEX audit_logs_target_idx ON audit_logs (target_type, target_id, created_at DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS audit_logs;
-- +goose StatementEnd

-- +goose StatementBegin
DROP TABLE IF EXISTS refresh_tokens;
-- +goose StatementEnd

-- +goose StatementBegin
DROP TRIGGER IF EXISTS super_admin_users_set_updated_at ON super_admin_users;
-- +goose StatementEnd

-- +goose StatementBegin
DROP TABLE IF EXISTS super_admin_users;
-- +goose StatementEnd

-- +goose StatementBegin
DROP FUNCTION IF EXISTS set_updated_at();
-- +goose StatementEnd

-- +goose StatementBegin
DROP TYPE IF EXISTS super_admin_status;
-- +goose StatementEnd

-- +goose StatementBegin
DROP TYPE IF EXISTS super_admin_role;
-- +goose StatementEnd
