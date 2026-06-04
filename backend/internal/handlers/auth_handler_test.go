package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/rishisulakhe/shipwright/backend/internal/middleware"
	"github.com/rishisulakhe/shipwright/backend/internal/repository"
	"github.com/rishisulakhe/shipwright/backend/internal/testhelpers"
)

func setupAuthRouter(repos *repository.Repositories) http.Handler {
	r := chi.NewRouter()
	h := &AuthHandler{Repos: repos, JWTSecret: []byte(testhelpers.TestJWTSecret)}
	r.Post("/api/auth/register", h.Register)
	r.Post("/api/auth/login", h.Login)
	r.Post("/api/auth/refresh", h.Refresh)
	r.Get("/api/me", middleware.AuthMiddleware([]byte(testhelpers.TestJWTSecret))(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := middleware.GetClaims(r.Context())
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"user_id":  claims.UserID,
			"username": claims.Username,
			"role":      claims.Role,
		})
	})).(http.HandlerFunc))
	return r
}

func TestRegister(t *testing.T) {
	repos, _ := testhelpers.NewTestRepos(t)
	router := setupAuthRouter(repos)

	tests := []struct {
		name       string
		payload    map[string]string
		wantStatus int
		wantError  string
	}{
		{
			name: "valid registration",
			payload: map[string]string{
				"username": "newuser",
				"email":    "new@test.com",
				"password": "password123",
				"role":     "developer",
			},
			wantStatus: http.StatusCreated,
		},
		{
			name: "missing username",
			payload: map[string]string{
				"email":    "test@test.com",
				"password": "password123",
				"role":     "developer",
			},
			wantStatus: http.StatusBadRequest,
			wantError:  "all fields are required",
		},
		{
			name: "short password",
			payload: map[string]string{
				"username": "shortpw",
				"email":    "short@test.com",
				"password": "short",
				"role":     "developer",
			},
			wantStatus: http.StatusBadRequest,
			wantError:  "password must be at least 8 characters",
		},
		{
			name: "invalid role",
			payload: map[string]string{
				"username": "badrole",
				"email":    "bad@test.com",
				"password": "password123",
				"role":     "superadmin",
			},
			wantStatus: http.StatusBadRequest,
			wantError:  "role must be one of: admin, developer, viewer",
		},
		{
			name: "invalid email",
			payload: map[string]string{
				"username": "bademail",
				"email":    "not-an-email",
				"password": "password123",
				"role":     "developer",
			},
			wantStatus: http.StatusBadRequest,
			wantError:  "invalid email format",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.payload)
			req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()
			router.ServeHTTP(rr, req)

			if rr.Code != tt.wantStatus {
				t.Errorf("expected status %d, got %d; body: %s", tt.wantStatus, rr.Code, rr.Body.String())
			}

			if tt.wantError != "" {
				var resp map[string]string
				json.Unmarshal(rr.Body.Bytes(), &resp)
				if resp["error"] != tt.wantError {
					t.Errorf("expected error %q, got %q", tt.wantError, resp["error"])
				}
			}

			if tt.wantStatus == http.StatusCreated {
				var resp map[string]string
				json.Unmarshal(rr.Body.Bytes(), &resp)
				if resp["id"] == "" {
					t.Error("expected non-empty id in response")
				}
				if resp["username"] != tt.payload["username"] {
					t.Errorf("expected username %q, got %q", tt.payload["username"], resp["username"])
				}
			}
		})
	}
}

func TestRegisterDuplicateUsername(t *testing.T) {
	repos, _ := testhelpers.NewTestRepos(t)
	router := setupAuthRouter(repos)

	payload := map[string]string{
		"username": "dupuser",
		"email":    "dup1@test.com",
		"password": "password123",
		"role":     "developer",
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("first registration should succeed, got %d", rr.Code)
	}

	payload["email"] = "dup2@test.com"
	body, _ = json.Marshal(payload)
	req = httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusConflict {
		t.Errorf("expected status %d for duplicate username, got %d", http.StatusConflict, rr.Code)
	}
}

func TestLogin(t *testing.T) {
	repos, _ := testhelpers.NewTestRepos(t)
	router := setupAuthRouter(repos)

	regPayload := map[string]string{
		"username": "loginuser",
		"email":    "login@test.com",
		"password": "password123",
		"role":     "developer",
	}
	body, _ := json.Marshal(regPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("registration failed: %d", rr.Code)
	}

	tests := []struct {
		name       string
		username   string
		password   string
		wantStatus int
		wantError  string
	}{
		{
			name:       "correct credentials",
			username:   "loginuser",
			password:   "password123",
			wantStatus: http.StatusOK,
		},
		{
			name:       "wrong password",
			username:   "loginuser",
			password:   "wrongpassword",
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "non-existent user",
			username:   "nosuchuser",
			password:   "password123",
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := map[string]string{
				"username": tt.username,
				"password": tt.password,
			}
			body, _ := json.Marshal(payload)
			req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()
			router.ServeHTTP(rr, req)

			if rr.Code != tt.wantStatus {
				t.Errorf("expected status %d, got %d; body: %s", tt.wantStatus, rr.Code, rr.Body.String())
			}

			if tt.wantStatus == http.StatusOK {
				var resp map[string]interface{}
				json.Unmarshal(rr.Body.Bytes(), &resp)
				if resp["access_token"] == nil || resp["access_token"] == "" {
					t.Error("expected access_token in response")
				}
				if resp["refresh_token"] == nil || resp["refresh_token"] == "" {
					t.Error("expected refresh_token in response")
				}
				user := resp["user"].(map[string]interface{})
				if user["username"] != tt.username {
					t.Errorf("expected username %q, got %q", tt.username, user["username"])
				}
			}
		})
	}
}

func TestRefreshToken(t *testing.T) {
	repos, db := testhelpers.NewTestRepos(t)
	router := setupAuthRouter(repos)

	testhelpers.CleanTestDB(t, db)

	regPayload := map[string]string{
		"username": "refreshuser",
		"email":    "refresh@test.com",
		"password": "password123",
		"role":     "admin",
	}
	body, _ := json.Marshal(regPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusCreated {
		t.Fatalf("registration failed: %d - %s", rr.Code, rr.Body.String())
	}

	var regResp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &regResp)
	_ = regResp["id"].(string)

	loginPayload := map[string]string{
		"username": "refreshuser",
		"password": "password123",
	}
	body, _ = json.Marshal(loginPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rr = httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("login failed: %d - %s", rr.Code, rr.Body.String())
	}

	var loginResp map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &loginResp)
	refreshToken, ok := loginResp["refresh_token"].(string)
	if !ok || refreshToken == "" {
		t.Fatalf("no refresh_token in login response: %v", loginResp)
	}

	t.Run("valid refresh token", func(t *testing.T) {
		payload := map[string]string{"refresh_token": refreshToken}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Errorf("expected status %d, got %d; body: %s", http.StatusOK, rr.Code, rr.Body.String())
		}

		var resp map[string]interface{}
		json.Unmarshal(rr.Body.Bytes(), &resp)
		if resp["access_token"] == nil || resp["access_token"] == "" {
			t.Error("expected new access_token")
		}
	})

	t.Run("invalid refresh token", func(t *testing.T) {
		payload := map[string]string{"refresh_token": "invalid-token"}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rr.Code)
		}
	})
}