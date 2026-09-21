package service

import (
	"golang.org/x/crypto/bcrypt"
)

// HashPassword 使用 bcrypt 保存密码，避免可被快速穷举的普通摘要。
func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hash), err
}

func CheckPassword(password, encoded string) bool {
	return bcrypt.CompareHashAndPassword([]byte(encoded), []byte(password)) == nil
}
