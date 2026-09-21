package service

import "testing"

func TestGenerateUserCode(t *testing.T) {
	code, err := GenerateUserCode()
	if err != nil {
		t.Fatal(err)
	}
	if len(code) != 6 {
		t.Fatalf("expected six-character code, got %q", code)
	}
	for _, char := range code {
		if (char < 'a' || char > 'z') && (char < '0' || char > '9') {
			t.Fatalf("unexpected code character %q", char)
		}
	}
}

func TestJWTBindsIP(t *testing.T) {
	token, err := CreateJWT(JWTClaims{UserID: 1, Role: "user", IP: "127.0.0.1", Exp: 4102444800})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = ParseJWT(token, "127.0.0.2"); err == nil {
		t.Fatal("JWT should reject a different IP")
	}
	if _, err = ParseJWT(token, "127.0.0.1"); err != nil {
		t.Fatal(err)
	}
}
