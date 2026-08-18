-- +goose Up

-- +goose StatementBegin
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TYPE ticket_priority AS ENUM ('low', 'normal', 'high');
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TYPE ticket_message_author AS ENUM ('client', 'team');
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE support_tickets (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subject          text NOT NULL,
    status           ticket_status NOT NULL DEFAULT 'open',
    priority         ticket_priority NOT NULL DEFAULT 'normal',
    assignee_id      uuid REFERENCES super_admin_users(id) ON DELETE SET NULL,
    -- Контактное лицо клиента — от его имени идут сообщения с author = 'client'
    contact_name     text NOT NULL DEFAULT '',
    -- Денормализовано ради сортировки списка без join с сообщениями;
    -- держит в актуальном состоянии триггер support_ticket_messages_touch ниже
    last_message_at  timestamptz NOT NULL DEFAULT now(),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TRIGGER support_tickets_set_updated_at
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- +goose StatementEnd

-- +goose StatementBegin
CREATE INDEX support_tickets_tenant_id_idx ON support_tickets (tenant_id, created_at DESC);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE INDEX support_tickets_status_idx ON support_tickets (status);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE INDEX support_tickets_assignee_id_idx ON support_tickets (assignee_id);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TABLE support_ticket_messages (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id   uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    author      ticket_message_author NOT NULL,
    -- Для клиента — контактное лицо, для команды — имя сотрудника; дублирует
    -- author_id намеренно, как actor_email в audit_logs — сообщение должно
    -- оставаться читаемым после удаления сотрудника
    author_name text NOT NULL DEFAULT '',
    author_id   uuid REFERENCES super_admin_users(id) ON DELETE SET NULL,
    body        text NOT NULL,
    sent_at     timestamptz NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE INDEX support_ticket_messages_ticket_id_idx ON support_ticket_messages (ticket_id, sent_at);
-- +goose StatementEnd

-- +goose StatementBegin
CREATE FUNCTION touch_ticket_last_message() RETURNS trigger AS $$
BEGIN
    UPDATE support_tickets SET last_message_at = NEW.sent_at, updated_at = now()
    WHERE id = NEW.ticket_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TRIGGER support_ticket_messages_touch
    AFTER INSERT ON support_ticket_messages
    FOR EACH ROW EXECUTE FUNCTION touch_ticket_last_message();
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS support_ticket_messages;
-- +goose StatementEnd

-- +goose StatementBegin
DROP FUNCTION IF EXISTS touch_ticket_last_message();
-- +goose StatementEnd

-- +goose StatementBegin
DROP TABLE IF EXISTS support_tickets;
-- +goose StatementEnd

-- +goose StatementBegin
DROP TYPE IF EXISTS ticket_message_author;
-- +goose StatementEnd

-- +goose StatementBegin
DROP TYPE IF EXISTS ticket_priority;
-- +goose StatementEnd

-- +goose StatementBegin
DROP TYPE IF EXISTS ticket_status;
-- +goose StatementEnd
