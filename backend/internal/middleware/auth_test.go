package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rishisulakhe/shipwright/backend/internal/auth"
)

func TestAuthMiddleware(t *testing.T) {
	secret := []byte("test-secret")
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := GetClaims(r.Context())
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"user_id":  claims.UserID,
			"username": claims.Username,
			"role":      claims.Role,
		})
	})

	t.Run("valid token passes middleware", func(t *testing.T) {
		token, _ := auth.GenerateAccessToken("user-1", "testuser", "admin", secret)
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rr := httptest.NewRecorder()

		handler := AuthMiddleware(secret)(nextHandler)
		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, rr.Code)
		}

		var resp map[string]string
		json.Unmarshal(rr.Body.Bytes(), &resp)
		if resp["user_id"] != "user-1" {
			t.Errorf("expected user_id 'user-1', got %q", resp["user_id"])
		}
		if resp["username"] != "testuser" {
			t.Errorf("expected username 'testuser', got %q", resp["username"])
		}
		if resp["role"] != "admin" {
			t.Errorf("expected role 'admin', got %q", resp["role"])
		}
	})

	t.Run("missing authorization header returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		rr := httptest.NewRecorder()

		handler := AuthMiddleware(secret)(nextHandler)
		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rr.Code)
		}
	})

	t.Run("invalid token format returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Authorization", "Bearer invalid-token")
		rr := httptest.NewRecorder()

		handler := AuthMiddleware(secret)(nextHandler)
		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rr.Code)
		}
	})

	t.Run("wrong signing key returns 401", func(t *testing.T) {
		wrongSecret := []byte("wrong-secret")
		token, _ := auth.GenerateAccessToken("user-1", "testuser", "admin", wrongSecret)
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rr := httptest.NewRecorder()

		handler := AuthMiddleware(secret)(nextHandler)
		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rr.Code)
		}
	})

	t.Run("expired token returns 401", func(t *testing.T) {
		now := time.Now()
		claims := auth.Claims{
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

		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("Authorization", "Bearer "+tokenStr)
		rr := httptest.NewRecorder()

		handler := AuthMiddleware(secret)(nextHandler)
		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rr.Code)
		}
	})
}

func TestRequireRole(t *testing.T) {
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	t.Run("allowed role passes", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		rr := httptest.NewRecorder()

		handler := RequireRole("admin", "developer")(nextHandler)
		ctx := context.WithValue(req.Context(), claimsKey, &Claims{UserID: "1", Username: "u", Role: "admin"})
		handler.ServeHTTP(rr, req.WithContext(ctx))

		if rr.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, rr.Code)
		}
	})

	t.Run("disallowed role returns 403", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		rr := httptest.NewRecorder()

		handler := RequireRole("admin")(nextHandler)
		ctx := context.WithValue(req.Context(), claimsKey, &Claims{UserID: "1", Username: "u", Role: "viewer"})
		handler.ServeHTTP(rr, req.WithContext(ctx))

		if rr.Code != http.StatusForbidden {
			t.Errorf("expected status %d, got %d", http.StatusForbidden, rr.Code)
		}
	})

	t.Run("no claims returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		rr := httptest.NewRecorder()

		handler := RequireRole("admin")(nextHandler)
		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rr.Code)
		}
	})
}

func TestGetUserID(t *testing.T) {
	t.Run("returns empty string with no claims", func(t *testing.T) {
		ctx := context.Background()
		if uid := GetUserID(ctx); uid != "" {
			t.Errorf("expected empty string, got %q", uid)
		}
	})
}

func TestGetRole(t *testing.T) {
	t.Run("returns empty string with no claims", func(t *testing.T) {
		ctx := context.Background()
		if role := GetRole(ctx); role != "" {
			t.Errorf("expected empty string, got %q", role)
		}
	})
}