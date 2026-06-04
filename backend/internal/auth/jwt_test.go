package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestHashAndCheckPassword(t *testing.T) {
	t.Run("hash and verify correct password", func(t *testing.T) {
		hash, err := HashPassword("mypassword123")
		if err != nil {
			t.Fatalf("HashPassword failed: %v", err)
		}
		if err := CheckPassword(hash, "mypassword123"); err != nil {
			t.Errorf("CheckPassword should succeed for correct password: %v", err)
		}
	})

	t.Run("wrong password fails", func(t *testing.T) {
		hash, _ := HashPassword("mypassword123")
		if err := CheckPassword(hash, "wrongpassword"); err == nil {
			t.Error("CheckPassword should fail for wrong password")
		}
	})

	t.Run("different hashes for same password", func(t *testing.T) {
		hash1, _ := HashPassword("samepassword")
		hash2, _ := HashPassword("samepassword")
		if hash1 == hash2 {
			t.Error("different hashes expected for same password due to salting")
		}
	})
}

func TestGenerateAndValidateAccessToken(t *testing.T) {
	secret := []byte("test-secret-key")

	t.Run("valid token round-trip", func(t *testing.T) {
		token, err := GenerateAccessToken("user-1", "testuser", "admin", secret)
		if err != nil {
			t.Fatalf("GenerateAccessToken failed: %v", err)
		}
		claims, err := ValidateToken(token, secret)
		if err != nil {
			t.Fatalf("ValidateToken failed: %v", err)
		}
		if claims.UserID != "user-1" {
			t.Errorf("expected UserID 'user-1', got %q", claims.UserID)
		}
		if claims.Username != "testuser" {
			t.Errorf("expected Username 'testuser', got %q", claims.Username)
		}
		if claims.Role != "admin" {
			t.Errorf("expected Role 'admin', got %q", claims.Role)
		}
	})

	t.Run("token with wrong secret fails", func(t *testing.T) {
		token, _ := GenerateAccessToken("user-1", "testuser", "admin", secret)
		_, err := ValidateToken(token, []byte("wrong-secret"))
		if err == nil {
			t.Error("expected validation to fail with wrong secret")
		}
	})

	t.Run("expired token fails", func(t *testing.T) {
		now := time.Now()
		claims := Claims{
			RegisteredClaims: jwt.RegisteredClaims{
				Issuer:    "docker-dashboard",
				Subject:   "user-1",
				ExpiresAt: jwt.NewNumericDate(now.Add(-1 * time.Hour)),
				IssuedAt:  jwt.NewNumericDate(now.Add(-2 * time.Hour)),
			},
			UserID:   "user-1",
			Username: "testuser",
			Role:     "admin",
		}
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenStr, _ := token.SignedString(secret)

		_, err := ValidateToken(tokenStr, secret)
		if err == nil {
			t.Error("expected validation to fail for expired token")
		}
	})

	t.Run("invalid signing method fails", func(t *testing.T) {
		claims := Claims{
			RegisteredClaims: jwt.RegisteredClaims{
				Issuer:    "docker-dashboard",
				Subject:   "user-1",
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
				IssuedAt:  jwt.NewNumericDate(time.Now()),
			},
			UserID:   "user-1",
			Username: "testuser",
			Role:     "admin",
		}
		token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
		tokenStr, _ := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
		_, err := ValidateToken(tokenStr, secret)
		if err == nil {
			t.Error("expected validation to fail for wrong signing method")
		}
	})
}

func TestGenerateAndValidateRefreshToken(t *testing.T) {
	secret := []byte("test-secret-key")

	t.Run("valid refresh token round-trip", func(t *testing.T) {
		token, err := GenerateRefreshToken("user-1", secret)
		if err != nil {
			t.Fatalf("GenerateRefreshToken failed: %v", err)
		}
		userID, err := ValidateRefreshToken(token, secret)
		if err != nil {
			t.Fatalf("ValidateRefreshToken failed: %v", err)
		}
		if userID != "user-1" {
			t.Errorf("expected userID 'user-1', got %q", userID)
		}
	})

	t.Run("refresh token with wrong secret fails", func(t *testing.T) {
		token, _ := GenerateRefreshToken("user-1", secret)
		_, err := ValidateRefreshToken(token, []byte("wrong-secret"))
		if err == nil {
			t.Error("expected validation to fail with wrong secret")
		}
	})

	t.Run("access token validated as refresh token returns user ID", func(t *testing.T) {
		accessToken, _ := GenerateAccessToken("user-1", "testuser", "admin", secret)
		userID, err := ValidateRefreshToken(accessToken, secret)
		if err != nil {
			t.Errorf("access token should parse as refresh token, got error: %v", err)
		}
		if userID != "user-1" {
			t.Errorf("expected userID 'user-1', got %q", userID)
		}
	})
}