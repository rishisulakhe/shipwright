package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/rishisulakhe/shipwright/backend/internal/auth"
)

type contextKey string

const (
	claimsKey contextKey = "claims"
)

type Claims struct {
	UserID   string
	Username string
	Role     string
}

func AuthMiddleware(jwtSecret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				respondUnauthorized(w, "missing authorization header")
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
				respondUnauthorized(w, "invalid authorization header format")
				return
			}

			tokenStr := parts[1]
			claims, err := auth.ValidateToken(tokenStr, jwtSecret)
			if err != nil {
				respondUnauthorized(w, "invalid or expired token")
				return
			}

			ctx := context.WithValue(r.Context(), claimsKey, &Claims{
				UserID:   claims.UserID,
				Username: claims.Username,
				Role:     claims.Role,
			})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireRole(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			c := GetClaims(r.Context())
			if c == nil {
				respondUnauthorized(w, "unauthorized")
				return
			}
			if !allowed[c.Role] {
				respondForbidden(w, "forbidden")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func GetClaims(ctx context.Context) *Claims {
	c, ok := ctx.Value(claimsKey).(*Claims)
	if !ok {
		return nil
	}
	return c
}

func GetUserID(ctx context.Context) string {
	c := GetClaims(ctx)
	if c == nil {
		return ""
	}
	return c.UserID
}

func GetRole(ctx context.Context) string {
	c := GetClaims(ctx)
	if c == nil {
		return ""
	}
	return c.Role
}

func respondUnauthorized(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func respondForbidden(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}