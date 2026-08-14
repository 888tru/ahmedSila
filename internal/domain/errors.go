// Package domain содержит сущности и интерфейсы (порты) предметной области.
// Здесь нет зависимостей от Gin, sqlc, Redis и вообще от чего-либо внешнего —
// это правило проверяется тестом TestDomainHasNoExternalDeps.
package domain

import (
	"errors"
	"fmt"
)

// Базовые ошибки предметной области. Слой delivery — единственный, кто знает,
// в какой HTTP-статус или gRPC-код они превращаются (см. internal/delivery/http/errors.go).
var (
	ErrNotFound        = errors.New("не найдено")
	ErrConflict        = errors.New("конфликт состояния")
	ErrForbidden       = errors.New("доступ запрещён")
	ErrUnauthenticated = errors.New("требуется аутентификация")

	// ErrInvalidCredentials намеренно не различает «нет такого пользователя»
	// и «неверный пароль» — иначе endpoint становится оракулом существования учёток.
	ErrInvalidCredentials = errors.New("неверный email или пароль")
	ErrAccountLocked      = errors.New("учётная запись временно заблокирована")
	ErrSessionRevoked     = errors.New("сессия отозвана")
)

// ValidationError — ошибка валидации с привязкой к полю.
// Оборачивает ErrValidation, чтобы errors.Is работал на общий случай.
type ValidationError struct {
	Field   string
	Message string
}

var ErrValidation = errors.New("ошибка валидации")

func (e *ValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

func (e *ValidationError) Unwrap() error { return ErrValidation }

func NewValidationError(field, message string) *ValidationError {
	return &ValidationError{Field: field, Message: message}
}
