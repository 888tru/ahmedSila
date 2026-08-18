-- name: CreateInvitation :one
INSERT INTO super_admin_invitations (email, role, token_hash, invited_by, expires_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: HasPendingInvitation :one
SELECT EXISTS (
    SELECT 1 FROM super_admin_invitations
    WHERE email = $1 AND accepted_at IS NULL
) AS exists;
