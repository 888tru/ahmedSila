-- name: ListTickets :many
-- Фильтр по назначению (конкретный сотрудник / «без назначения») — в Go-коде
-- репозитория: тикетов на суперадминку — десятки-сотни, а не миллионы, третий
-- optional-параметр вперемешку с sqlc.narg усложнил бы запрос сильнее, чем
-- экономит.
SELECT * FROM support_tickets
WHERE (sqlc.narg('tenant_id')::uuid IS NULL OR tenant_id = sqlc.narg('tenant_id')::uuid)
  AND (sqlc.narg('status')::ticket_status IS NULL OR status = sqlc.narg('status')::ticket_status)
ORDER BY last_message_at DESC;

-- name: GetTicketByID :one
SELECT * FROM support_tickets WHERE id = $1;

-- name: ListTicketMessages :many
SELECT * FROM support_ticket_messages WHERE ticket_id = $1 ORDER BY sent_at;

-- name: CreateTicketMessage :one
INSERT INTO support_ticket_messages (ticket_id, author, author_name, author_id, body)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateTicketStatus :one
UPDATE support_tickets SET status = $2 WHERE id = $1
RETURNING *;

-- name: UpdateTicketPriority :one
UPDATE support_tickets SET priority = $2 WHERE id = $1
RETURNING *;

-- name: AssignTicket :one
UPDATE support_tickets SET assignee_id = $2 WHERE id = $1
RETURNING *;
