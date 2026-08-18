-- +goose Up

-- Приглашения в команду (экран «Команда», PAGES.md §7). Строка в
-- super_admin_users появляется только после того, как сотрудник примет
-- приглашение и задаст пароль сам — до этого его формально нет в системе.
-- Реальная отправка письма — отдельная задача (CLAUDE.md, «Дальше»): пока
-- ссылка активации возвращается в ответе API, как код подтверждения у клиента.
-- +goose StatementBegin
CREATE TABLE super_admin_invitations (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email       citext NOT NULL,
    role        super_admin_role NOT NULL,
    -- Токен активации не хранится — только его SHA-256, как refresh-токен
    token_hash  bytea NOT NULL UNIQUE,
    invited_by  uuid REFERENCES super_admin_users(id) ON DELETE SET NULL,
    expires_at  timestamptz NOT NULL,
    accepted_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- На один email — не больше одного непринятого приглашения одновременно.
-- +goose StatementBegin
CREATE UNIQUE INDEX super_admin_invitations_pending_email_idx
    ON super_admin_invitations (email) WHERE accepted_at IS NULL;
-- +goose StatementEnd

-- Шаблоны сообщений клиентам (экран «Настройки», PAGES.md §8). Ключ, а не
-- отдельная таблица на каждый шаблон: сейчас шаблон один, но добавление
-- второго — это INSERT новой строки, а не миграция схемы.
-- +goose StatementBegin
CREATE TABLE message_templates (
    key        text PRIMARY KEY,
    body       text NOT NULL,
    updated_at timestamptz,
    updated_by uuid REFERENCES super_admin_users(id) ON DELETE SET NULL
);
-- +goose StatementEnd

-- updated_at остаётся NULL — экран отличает «текст по умолчанию, ещё никто
-- не сохранял» от «сохранили и вернули тот же текст обратно».
-- +goose StatementBegin
INSERT INTO message_templates (key, body) VALUES (
    'activation_code',
    E'Здравствуйте, {владелец}!\n\nДоступ для магазина «{клиент}» открыт. Код подтверждения для первого входа: {код}\n\nКод одноразовый и действует до {срок}. Введите его при первом входе — после этого вы зададите пароль и будете входить обычным способом.\n\nЕсли код не сработал или срок истёк, ответьте на это сообщение — пришлём новый.'
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS message_templates;
-- +goose StatementEnd

-- +goose StatementBegin
DROP INDEX IF EXISTS super_admin_invitations_pending_email_idx;
-- +goose StatementEnd

-- +goose StatementBegin
DROP TABLE IF EXISTS super_admin_invitations;
-- +goose StatementEnd
