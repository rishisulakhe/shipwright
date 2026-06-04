package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rishisulakhe/shipwright/backend/internal/middleware"
	"github.com/rishisulakhe/shipwright/backend/internal/testhelpers"
)

func TestHealthHandler(t *testing.T) {
	repos, _ := testhelpers.NewTestRepos(t)

	t.Run("health endpoint returns ok", func(t *testing.T) {
		h := &HealthHandler{DB: nil}
		req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
		rr := httptest.NewRecorder()
		h.Health(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, rr.Code)
		}

		var resp map[string]interface{}
		json.Unmarshal(rr.Body.Bytes(), &resp)
		if resp["status"] != "ok" {
			t.Errorf("expected status 'ok', got %v", resp["status"])
		}
	})

	t.Run("db health with nil db returns 503", func(t *testing.T) {
		h := &HealthHandler{DB: nil}
		req := httptest.NewRequest(http.MethodGet, "/api/health/db", nil)
		rr := httptest.NewRecorder()
		h.DBHealth(rr, req)

		if rr.Code != http.StatusServiceUnavailable {
			t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, rr.Code)
		}
	})

	_ = repos
}

func TestMeHandler(t *testing.T) {
	secret := []byte(testhelpers.TestJWTSecret)
	h := &MeHandler{}

	t.Run("me handler with valid auth returns user info", func(t *testing.T) {
		token := testhelpers.GenerateTestToken("user-1", "testuser", "admin")
		req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rr := httptest.NewRecorder()

		handler := middleware.AuthMiddleware(secret)(http.HandlerFunc(h.Me))
		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d", http.StatusOK, rr.Code)
		}
	})

	t.Run("me handler without auth returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
		rr := httptest.NewRecorder()

		h.Me(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rr.Code)
		}
	})
}