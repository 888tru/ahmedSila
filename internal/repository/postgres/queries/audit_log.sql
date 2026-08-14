-- name: WriteAuditLog :exec
INSERT INTO audit_logs (actor_id, actor_email, action, target_type, target_id, metadata, ip, user_agent, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE(sqlc.narg('created_at')::timestamptz, now()));

-- name: ListAuditLogs :many
-- Необязательные фильтры через sqlc.narg: NULL означает «не фильтровать»
SELECT * FROM audit_logs
WHERE (sqlc.narg('actor_id')::uuid IS NULL OR actor_id = sqlc.narg('actor_id')::uuid)
  AND (sqlc.narg('action')::text IS NULL OR action = sqlc.narg('action')::text)
  AND (sqlc.narg('target_type')::text IS NULL OR target_type = sqlc.narg('target_type')::text)
  AND (sqlc.narg('target_id')::text IS NULL OR target_id = sqlc.narg('target_id')::text)
  AND (sqlc.narg('from_time')::timestamptz IS NULL OR created_at >= sqlc.narg('from_time')::timestamptz)
  AND (sqlc.narg('to_time')::timestamptz IS NULL OR created_at <= sqlc.narg('to_time')::timestamptz)
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg('result_limit') OFFSET sqlc.arg('result_offset');

-- name: CountAuditLogs :one
SELECT count(*) FROM audit_logs
WHERE (sqlc.narg('actor_id')::uuid IS NULL OR actor_id = sqlc.narg('actor_id')::uuid)
  AND (sqlc.narg('action')::text IS NULL OR action = sqlc.narg('action')::text)
  AND (sqlc.narg('target_type')::text IS NULL OR target_type = sqlc.narg('target_type')::text)
  AND (sqlc.narg('target_id')::text IS NULL OR target_id = sqlc.narg('target_id')::text)
  AND (sqlc.narg('from_time')::timestamptz IS NULL OR created_at >= sqlc.narg('from_time')::timestamptz)
  AND (sqlc.narg('to_time')::timestamptz IS NULL OR created_at <= sqlc.narg('to_time')::timestamptz);
