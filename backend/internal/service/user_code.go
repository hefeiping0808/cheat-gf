package service

import (
	"crypto/rand"
	"math/big"
	"strings"
)

const userCodeAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789"

// GenerateUserCode 生成用户公开访问 code，使用密码学随机源而不是可预测的自增值。
// 更新时间：2026-09-10 15:12:00 CST。
func GenerateUserCode() (string, error) {
	code := make([]byte, 6)
	max := big.NewInt(int64(len(userCodeAlphabet)))
	for i := range code {
		index, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		code[i] = userCodeAlphabet[index.Int64()]
	}
	return string(code), nil
}

func NormalizeUserCode(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func IsValidUserCode(code string) bool {
	if len(code) != 6 {
		return false
	}
	for _, char := range code {
		if (char < 'a' || char > 'z') && (char < '0' || char > '9') {
			return false
		}
	}
	return true
}
