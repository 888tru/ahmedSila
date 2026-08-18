-- +goose Up

-- Клиенты (в коде — tenant, для пользователя — «Клиент», см. CLAUDE.md).
-- Без desired_status/observed_status: этот раздел нужен только для сверки
-- с целевым сервисом по gRPC, а его нет в MVP (см. CLAUDE.md, «Не делаем
-- в MVP») — добавится миграцией, когда дойдёт до интеграции.
-- +goose StatementBegin
CREATE TYPE tenant_status AS ENUM ('active', 'trial', 'paused');
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TYPE tenant_plan AS ENUM ('Starter', 'Growth', 'Enterprise');
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE tenants (
    id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                       text NOT NULL,
    city                       text NOT NULL DEFAULT '',
    address                    text NOT NULL DEFAULT '',
    status                     tenant_status NOT NULL,
    plan                       tenant_plan NOT NULL,
    employees                  integer NOT NULL DEFAULT 0,
    owner_name                 text NOT NULL DEFAULT '',
    phone                      text NOT NULL DEFAULT '',
    email                      citext NOT NULL UNIQUE,
    last_active_at             timestamptz,
    -- Есть только у status = 'trial'
    trial_ends_at              timestamptz,
    -- Заполнена, только когда status = 'paused'
    suspended_reason           text,
    -- Открытым текстом, не хеш: карточка клиента показывает и пересылает код
    -- повторно в любой момент, пока он действует — это одноразовый бутстрап
    -- первого входа, а не долговременный секрет (см. ClientAccessTab на фронте)
    activation_code            text,
    activation_code_expires_at timestamptz,
    created_at                 timestamptz NOT NULL DEFAULT now(),
    updated_at                 timestamptz NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TRIGGER tenants_set_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- +goose StatementEnd

-- +goose StatementBegin
CREATE INDEX tenants_status_idx ON tenants (status);
-- +goose StatementEnd

-- Список «Триал заканчивается скоро» на «Обзоре» бьёт именно по этому условию
-- +goose StatementBegin
CREATE INDEX tenants_trial_ends_at_idx ON tenants (trial_ends_at) WHERE status = 'trial';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS tenants;
-- +goose StatementEnd

-- +goose StatementBegin
DROP TYPE IF EXISTS tenant_plan;
-- +goose StatementEnd

-- +goose StatementBegin
DROP TYPE IF EXISTS tenant_status;
-- +goose StatementEnd
