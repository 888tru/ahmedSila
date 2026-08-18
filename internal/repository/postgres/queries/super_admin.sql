-- name: CreateSuperAdmin :one
INSERT INTO super_admin_users (email, full_name, password_hash, role, status)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetSuperAdminByID :one
SELECT * FROM super_admin_users WHERE id = $1;

-- name: GetSuperAdminByEmail :one
-- email — citext, поэтому сравнение регистронезависимое на стороне БД
SELECT * FROM super_admin_users WHERE email = $1;

-- name: ListSuperAdmins :many
SELECT * FROM super_admin_users ORDER BY created_at;

-- name: RegisterFailedLogin :exec
-- Инкремент и блокировка одним UPDATE: между чтением и записью не должно
-- быть окна, в которое влезут параллельные попытки подбора
UPDATE super_admin_users
SET failed_login_attempts = failed_login_attempts + 1,
    locked_until = COALESCE(sqlc.narg('locked_until')::timestamptz, locked_until)
WHERE id = $1;

-- name: RegisterSuccessfulLogin :exec
UPDATE super_admin_users
SET failed_login_attempts = 0,
    locked_until = NULL,
    last_login_at = $2
WHERE id = $1;

-- name: SetTOTPSecret :exec
UPDATE super_admin_users
SET totp_secret = $2,
    totp_enrolled_at = $3
WHERE id = $1;

-- name: UpdateSuperAdminRole :one
UPDATE super_admin_users SET role = $2 WHERE id = $1
RETURNING *;

-- name: UpdateSuperAdminStatus :one
UPDATE super_admin_users SET status = $2 WHERE id = $1
RETURNING *;
