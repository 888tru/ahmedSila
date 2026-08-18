-- name: GetMessageTemplate :one
SELECT * FROM message_templates WHERE key = $1;

-- name: UpdateMessageTemplate :one
UPDATE message_templates
SET body = $2, updated_at = $3, updated_by = $4
WHERE key = $1
RETURNING *;
