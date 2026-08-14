// Package hash — argon2id-хеширование паролей.
package hash

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"runtime"
	"strings"

	"golang.org/x/crypto/argon2"
)

// Params — параметры argon2id. Дефолты — рекомендация OWASP (19 МБ, 2 прохода).
type Params struct {
	Memory      uint32 // КиБ
	Iterations  uint32
	Parallelism uint8
	SaltLength  uint32
	KeyLength   uint32
}

func DefaultParams() Params {
	p := uint8(runtime.NumCPU())
	if p > 4 {
		p = 4
	}
	if p == 0 {
		p = 1
	}
	return Params{
		Memory:      19 * 1024,
		Iterations:  2,
		Parallelism: p,
		SaltLength:  16,
		KeyLength:   32,
	}
}

// TestParams — минимальные параметры для тестов: иначе каждый тест
// с логином молотит по 19 МБ памяти.
func TestParams() Params {
	return Params{Memory: 64, Iterations: 1, Parallelism: 1, SaltLength: 8, KeyLength: 16}
}

var (
	ErrInvalidHashFormat = errors.New("некорректный формат хеша пароля")
	ErrIncompatibleAlgo  = errors.New("несовместимый алгоритм хеширования")
)

type Argon2Hasher struct {
	params Params
}

func NewArgon2(p Params) *Argon2Hasher { return &Argon2Hasher{params: p} }

// Hash возвращает PHC-строку вида
// $argon2id$v=19$m=19456,t=2,p=4$<salt-b64>$<hash-b64>
func (h *Argon2Hasher) Hash(plain string) (string, error) {
	salt := make([]byte, h.params.SaltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("генерация соли: %w", err)
	}

	key := argon2.IDKey([]byte(plain), salt, h.params.Iterations, h.params.Memory, h.params.Parallelism, h.params.KeyLength)

	return fmt.Sprintf(
		"$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, h.params.Memory, h.params.Iterations, h.params.Parallelism,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(key),
	), nil
}

// Verify сравнивает пароль с хешем за постоянное время.
// Параметры берутся из самого хеша, поэтому смена DefaultParams не ломает
// уже сохранённые пароли.
func (h *Argon2Hasher) Verify(plain, encodedHash string) (bool, error) {
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 6 {
		return false, ErrInvalidHashFormat
	}
	if parts[1] != "argon2id" {
		return false, ErrIncompatibleAlgo
	}

	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil {
		return false, ErrInvalidHashFormat
	}
	if version != argon2.Version {
		return false, ErrIncompatibleAlgo
	}

	var memory, iterations uint32
	var parallelism uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &iterations, &parallelism); err != nil {
		return false, ErrInvalidHashFormat
	}

	salt, err := base64.RawStdEncoding.Strict().DecodeString(parts[4])
	if err != nil {
		return false, ErrInvalidHashFormat
	}
	want, err := base64.RawStdEncoding.Strict().DecodeString(parts[5])
	if err != nil {
		return false, ErrInvalidHashFormat
	}

	got := argon2.IDKey([]byte(plain), salt, iterations, memory, parallelism, uint32(len(want)))

	return subtle.ConstantTimeCompare(got, want) == 1, nil
}

// DummyVerify тратит столько же времени, сколько настоящая проверка.
// Вызывается, когда пользователь не найден, — иначе разница во времени ответа
// превращает login в оракул существования учёток.
func (h *Argon2Hasher) DummyVerify() {
	argon2.IDKey([]byte("dummy"), make([]byte, h.params.SaltLength),
		h.params.Iterations, h.params.Memory, h.params.Parallelism, h.params.KeyLength)
}
