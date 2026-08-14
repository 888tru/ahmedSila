// Команда genkeys печатает свежую пару Ed25519-ключей для подписи access-токенов.
//
// Вывод вставляется в .env для локальной разработки. В staging/prod ключи
// приходят из secrets manager — файлов с ключами в репозитории быть не должно.
package main

import (
	"fmt"
	"os"

	"github.com/ahmedsila/superadmin/internal/pkg/jwt"
)

func main() {
	priv, pub, err := jwt.GenerateKeyPair()
	if err != nil {
		fmt.Fprintln(os.Stderr, "не удалось сгенерировать ключи:", err)
		os.Exit(1)
	}

	fmt.Println("# Вставьте в .env (для локальной разработки):")
	fmt.Printf("JWT_PRIVATE_KEY=%s\n", priv)
	fmt.Printf("JWT_PUBLIC_KEY=%s\n", pub)
}
