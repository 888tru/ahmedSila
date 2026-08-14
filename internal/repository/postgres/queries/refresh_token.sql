-- name: CreateRefreshToken :one
INSERT INTO refresh_tokens (id, user_id, session_id, token_hash, expires_at, user_agent, ip)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetRefreshTokenByHash :one
SELECT * FROM refresh_tokens WHERE token_hash = $1;

-- name: MarkRefreshTokenUsed :exec
-- Условие used_at IS NULL делает операцию идемпотентной: параллельный повтор
-- того же refresh не перезапишет связь и не спрячет факт переиспользования
UPDATE refresh_tokens
SET used_at = $2,
    replaced_by = $3
WHERE id = $1 AND used_at IS NULL;

-- name: RevokeRefreshTokenSession :exec
UPDATE refresh_tokens
SET revoked_at = $2,
    revoked_reason = $3
WHERE session_id = $1 AND revoked_at IS NULL;

-- name: RevokeAllRefreshTokensForUser :exec
UPDATE refresh_tokens
SET revoked_at = $2,
    revoked_reason = $3
WHERE user_id = $1 AND revoked_at IS NULL;

-- name: DeleteExpiredRefreshTokens :execrows
DELETE FROM refresh_tokens WHERE expires_at < $1;
