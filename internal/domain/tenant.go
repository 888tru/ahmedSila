package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// TenantStatus — статус клиента. В коде — tenant, для пользователя — «Клиент»
// (см. CLAUDE.md). Без desired/observed: сверка с целевым сервисом по gRPC
// не входит в MVP.
type TenantStatus string

const (
	TenantStatusActive TenantStatus = "active"
	TenantStatusTrial  TenantStatus = "trial"
	TenantStatusPaused TenantStatus = "paused"
)

func (s TenantStatus) Valid() bool {
	switch s {
	case TenantStatusActive, TenantStatusTrial, TenantStatusPaused:
		return true
	default:
		return false
	}
}

type TenantPlan string

const (
	TenantPlanStarter    TenantPlan = "Starter"
	TenantPlanGrowth     TenantPlan = "Growth"
	TenantPlanEnterprise TenantPlan = "Enterprise"
)

func (p TenantPlan) Valid() bool {
	switch p {
	case TenantPlanStarter, TenantPlanGrowth, TenantPlanEnterprise:
		return true
	default:
		return false
	}
}

// Tenant — клиент (магазин/супермаркет), которому суперадминка выдаёт доступ
// к целевому сервису.
type Tenant struct {
	ID                      uuid.UUID
	Name                    string
	City                    string
	Address                 string
	Status                  TenantStatus
	Plan                    TenantPlan
	Employees               int
	OwnerName               string
	Phone                   string
	Email                   string
	LastActiveAt            *time.Time
	TrialEndsAt             *time.Time
	SuspendedReason         *string
	ActivationCode          *string
	ActivationCodeExpiresAt *time.Time
	CreatedAt               time.Time
	UpdatedAt               time.Time
}

// NewTenant — данные, нужные бэкенду, чтобы завести клиента (PAGES.md §4.1).
// Город отдельным полем не приходит: в форме это одна строка «Город и адрес»,
// как её диктует клиент по телефону; разбор на город/улицу — со стороны
// вызывающего (см. mock.ts на фронте, тот же приём).
type NewTenant struct {
	Name      string
	City      string
	Address   string
	OwnerName string
	Phone     string
	Email     string
	Plan      TenantPlan
	// 0 — клиент активируется сразу, без пробного периода
	TrialDays int
}

type TenantRepository interface {
	Create(ctx context.Context, t *Tenant) error
	GetByID(ctx context.Context, id uuid.UUID) (*Tenant, error)
	List(ctx context.Context) ([]Tenant, error)
	IsEmailTaken(ctx context.Context, email string) (bool, error)
	UpdateStatus(ctx context.Context, id uuid.UUID, status TenantStatus, suspendedReason *string) (*Tenant, error)
	SetActivationCode(ctx context.Context, id uuid.UUID, code string, expiresAt time.Time) (*Tenant, error)
	Delete(ctx context.Context, id uuid.UUID) error
}
