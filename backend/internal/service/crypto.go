package service

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

var errInvalidToken = errors.New("invalid token")

// JWTClaims 是管理端 JWT 的最小声明集合，IP 被纳入签名内容并在每次请求时校验。
type JWTClaims struct {
	UserID int64  `json:"sub"`
	Role   string `json:"role"`
	IP     string `json:"ip"`
	Exp    int64  `json:"exp"`
}

func jwtSecret() []byte {
	return []byte(configString("app.jwtSecret", "cheat-gf-change-this-jwt-secret"))
}

func base64URL(v []byte) string {
	return base64.RawURLEncoding.EncodeToString(v)
}

func signJWT(input string) string {
	h := hmac.New(sha256.New, jwtSecret())
	_, _ = h.Write([]byte(input))
	return base64URL(h.Sum(nil))
}

func CreateJWT(claims JWTClaims) (string, error) {
	header, err := json.Marshal(map[string]string{"alg": "HS256", "typ": "JWT"})
	if err != nil {
		return "", err
	}
	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	input := base64URL(header) + "." + base64URL(payload)
	return input + "." + signJWT(input), nil
}

func ParseJWT(token, ip string) (JWTClaims, error) {
	var claims JWTClaims
	parts := strings.Split(token, ".")
	if len(parts) != 3 || !hmac.Equal([]byte(parts[2]), []byte(signJWT(parts[0]+"."+parts[1]))) {
		return claims, errInvalidToken
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil || json.Unmarshal(payload, &claims) != nil || claims.Exp <= time.Now().Unix() || claims.IP != ip {
		return claims, errInvalidToken
	}
	return claims, nil
}
