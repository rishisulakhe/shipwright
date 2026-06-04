package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/rishisulakhe/shipwright/backend/internal/auth"
	"github.com/rishisulakhe/shipwright/backend/internal/middleware"
	"github.com/rishisulakhe/shipwright/backend/internal/models"
	"github.com/rishisulakhe/shipwright/backend/internal/repository"
	"github.com/rishisulakhe/shipwright/backend/internal/testhelpers"
)

func createHostTestUser(t *testing.T, repos *repository.Repositories, username, role string) *models.User {
	t.Helper()
	hash, _ := auth.HashPassword("password123")
	user := &models.User{
		Username:     username,
		Email:        username + "@hosttest.com",
		PasswordHash: hash,
		Role:         role,
	}
	if err := repos.Users.Create(context.Background(), user); err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}
	return user
}

func TestHostList(t *testing.T) {
	repos, db := testhelpers.NewTestRepos(t)
	secret := []byte(testhelpers.TestJWTSecret)

	r := chi.NewRouter()
	r.Use(middleware.AuthMiddleware(secret))
	h := NewHostHandler(repos, secret)
	r.Get("/api/hosts", h.List)

	t.Run("admin sees all hosts", func(t *testing.T) {
		testhelpers.CleanTestDB(t, db)
		adminUser := createHostTestUser(t, repos, "seealladmin", "admin")
		devUser := createHostTestUser(t, repos, "seealldev", "developer")

		host1 := &models.DockerHost{
			OwnerID: adminUser.ID, Name: "admin-host", HostIP: "1.1.1.1",
			Port: 2375, Protocol: "tcp", AuthType: "none", IsActive: true,
		}
		host2 := &models.DockerHost{
			OwnerID: devUser.ID, Name: "dev-host", HostIP: "2.2.2.2",
			Port: 2375, Protocol: "tcp", AuthType: "none", IsActive: true,
		}
		repos.Hosts.Create(context.Background(), host1)
		repos.Hosts.Create(context.Background(), host2)

		token := testhelpers.GenerateTestToken(adminUser.ID.String(), adminUser.Username, "admin")
		req := httptest.NewRequest(http.MethodGet, "/api/hosts", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected status %d, got %d; body: %s", http.StatusOK, rr.Code, rr.Body.String())
		}

		var hosts []models.DockerHost
		json.Unmarshal(rr.Body.Bytes(), &hosts)
		if len(hosts) < 2 {
			t.Errorf("admin should see at least 2 hosts, got %d", len(hosts))
		}
	})

	t.Run("developer sees only own hosts", func(t *testing.T) {
		testhelpers.CleanTestDB(t, db)
		devUser := createHostTestUser(t, repos, "owntestdev", "developer")

		host := &models.DockerHost{
			OwnerID: devUser.ID, Name: "dev-host-2", HostIP: "3.3.3.3",
			Port: 2375, Protocol: "tcp", AuthType: "none", IsActive: true,
		}
		repos.Hosts.Create(context.Background(), host)

		token := testhelpers.GenerateTestToken(devUser.ID.String(), devUser.Username, "developer")
		req := httptest.NewRequest(http.MethodGet, "/api/hosts", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected status %d, got %d; body: %s", http.StatusOK, rr.Code, rr.Body.String())
		}

		var hosts []models.DockerHost
		json.Unmarshal(rr.Body.Bytes(), &hosts)
		if len(hosts) != 1 {
			t.Errorf("developer should see exactly 1 host, got %d", len(hosts))
		}
	})
}

func TestHostDelete(t *testing.T) {
	repos, db := testhelpers.NewTestRepos(t)
	secret := []byte(testhelpers.TestJWTSecret)

	r := chi.NewRouter()
	r.Use(middleware.AuthMiddleware(secret))
	h := NewHostHandler(repos, secret)
	r.Delete("/api/hosts/{hostID}", h.Delete)

	t.Run("owner can delete own host", func(t *testing.T) {
		testhelpers.CleanTestDB(t, db)
		user := createHostTestUser(t, repos, "delhostowner", "developer")

		host := &models.DockerHost{
			OwnerID: user.ID, Name: "my-host", HostIP: "4.4.4.4",
			Port: 2375, Protocol: "tcp", AuthType: "none", IsActive: true,
		}
		repos.Hosts.Create(context.Background(), host)

		token := testhelpers.GenerateTestToken(user.ID.String(), user.Username, "developer")
		req := httptest.NewRequest(http.MethodDelete, "/api/hosts/"+host.ID.String(), nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, req)

		if rr.Code != http.StatusNoContent {
			t.Errorf("expected status %d, got %d; body: %s", http.StatusNoContent, rr.Code, rr.Body.String())
		}
	})

	t.Run("admin can delete any host", func(t *testing.T) {
		testhelpers.CleanTestDB(t, db)
		devUser := createHostTestUser(t, repos, "delhostdev", "developer")
		adminUser := createHostTestUser(t, repos, "delhostadmin", "admin")

		host := &models.DockerHost{
			OwnerID: devUser.ID, Name: "dev-host-del", HostIP: "5.5.5.5",
			Port: 2375, Protocol: "tcp", AuthType: "none", IsActive: true,
		}
		repos.Hosts.Create(context.Background(), host)

		token := testhelpers.GenerateTestToken(adminUser.ID.String(), adminUser.Username, "admin")
		req := httptest.NewRequest(http.MethodDelete, "/api/hosts/"+host.ID.String(), nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, req)

		if rr.Code != http.StatusNoContent {
			t.Errorf("expected status %d, got %d; body: %s", http.StatusNoContent, rr.Code, rr.Body.String())
		}
	})

	t.Run("non-owner non-admin cannot delete host", func(t *testing.T) {
		testhelpers.CleanTestDB(t, db)
		owner := createHostTestUser(t, repos, "delhostowner2", "developer")
		other := createHostTestUser(t, repos, "delhostother", "developer")

		host := &models.DockerHost{
			OwnerID: owner.ID, Name: "owner-host", HostIP: "6.6.6.6",
			Port: 2375, Protocol: "tcp", AuthType: "none", IsActive: true,
		}
		repos.Hosts.Create(context.Background(), host)

		token := testhelpers.GenerateTestToken(other.ID.String(), other.Username, "developer")
		req := httptest.NewRequest(http.MethodDelete, "/api/hosts/"+host.ID.String(), nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, req)

		if rr.Code != http.StatusForbidden {
			t.Errorf("expected status %d, got %d; body: %s", http.StatusForbidden, rr.Code, rr.Body.String())
		}
	})
}