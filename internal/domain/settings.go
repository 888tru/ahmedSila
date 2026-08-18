package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// PlanInfo — справочные данные тарифа (экран «Настройки», PAGES.md §8).
//
// Хранится в коде, а не в таблице: тарифы меняются вместе с бизнес-условиями,
// то есть деплоем, а не через экран — заводить под это CRUD и миграцию
// значило бы строить админку ради данных, которые никто не редактирует из UI.
type PlanInfo struct {
	Plan     string
	Limit    string // «до 15», «без лимита» — не всегда число, текстом
	Price    string // «по договору» у Enterprise — тоже не всегда число
	Includes string
}

// MessageTemplateKey — единственный шаблон MVP: код подтверждения клиенту.
const MessageTemplateKey = "activation_code"

// MessageTemplate — редактируемый текст, который уходит клиенту вместе
// с кодом подтверждения.
type MessageTemplate struct {
	Key       string
	Body      string
	UpdatedAt *time.Time
	UpdatedBy *uuid.UUID
}

type MessageTemplateRepository interface {
	// Get возвращает ErrNotFound, если ключа нет — на практике не бывает,
	// начальная строка заведена миграцией 0002.
	Get(ctx context.Context, key string) (*MessageTemplate, error)
	Update(ctx context.Context, key, body string, updatedBy uuid.UUID, at time.Time) (*MessageTemplate, error)
}
