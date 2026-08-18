-- name: CreateTenant :one
INSERT INTO tenants (name, city, address, status, plan, owner_name, phone, email, trial_ends_at, activation_code, activation_code_expires_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: GetTenantByID :one
SELECT * FROM tenants WHERE id = $1;

-- name: ListTenants :many
SELECT * FROM tenants ORDER BY created_at DESC;

-- name: IsTenantEmailTaken :one
SELECT EXISTS (SELECT 1 FROM tenants WHERE email = $1) AS exists;

-- name: UpdateTenantStatus :one
UPDATE tenants SET status = $2, suspended_reason = $3 WHERE id = $1
RETURNING *;

-- name: SetTenantActivationCode :one
UPDATE tenants SET activation_code = $2, activation_code_expires_at = $3 WHERE id = $1
RETURNING *;

-- name: DeleteTenant :exec
DELETE FROM tenants WHERE id = $1;
