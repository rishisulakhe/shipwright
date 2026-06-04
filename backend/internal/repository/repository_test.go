package repository

import (
	"context"
	"database/sql"
	"testing"

	"github.com/google/uuid"
	"github.com/rishisulakhe/shipwright/backend/internal/auth"
	"github.com/rishisulakhe/shipwright/backend/internal/models"
	_ "github.com/lib/pq"
)

const testDBURL = "postgres://dduser:ddpass@localhost:5432/dockerdash_test?sslmode=disable"

func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("postgres", testDBURL)
	if err != nil {
		t.Fatalf("failed to connect to test db: %v", err)
	}
	if err := db.Ping(); err != nil {
		t.Fatalf("failed to ping test db: %v", err)
	}
	return db
}

func cleanTables(t *testing.T, db *sql.DB) {
	t.Helper()
	tables := []string{"images", "volumes", "networks", "containers", "docker_hosts", "users"}
	for _, table := range tables {
		db.Exec("DELETE FROM " + table)
	}
}

func newTestUser(t *testing.T, repos *Repositories, username, role string) *models.User {
	t.Helper()
	hash, _ := auth.HashPassword("password123")
	user := &models.User{
		Username:     username,
		Email:        username + "@repostest.com",
		PasswordHash: hash,
		Role:         role,
	}
	if err := repos.Users.Create(context.Background(), user); err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}
	return user
}

func TestUserRepo(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	repos := NewRepositories(db)
	cleanTables(t, db)

	t.Run("Create and FindByID", func(t *testing.T) {
		cleanTables(t, db)
		user := newTestUser(t, repos, "findiduser", "developer")
		found, err := repos.Users.FindByID(context.Background(), user.ID)
		if err != nil {
			t.Fatalf("FindByID failed: %v", err)
		}
		if found.Username != user.Username {
			t.Errorf("expected username %q, got %q", user.Username, found.Username)
		}
	})

	t.Run("FindByUsername", func(t *testing.T) {
		cleanTables(t, db)
		user := newTestUser(t, repos, "findbyname", "admin")
		found, err := repos.Users.FindByUsername(context.Background(), "findbyname")
		if err != nil {
			t.Fatalf("FindByUsername failed: %v", err)
		}
		if found.ID != user.ID {
			t.Errorf("expected ID %s, got %s", user.ID, found.ID)
		}
	})

	t.Run("FindByEmail", func(t *testing.T) {
		cleanTables(t, db)
		user := newTestUser(t, repos, "findbymail", "developer")
		found, err := repos.Users.FindByEmail(context.Background(), "findbymail@repostest.com")
		if err != nil {
			t.Fatalf("FindByEmail failed: %v", err)
		}
		if found.ID != user.ID {
			t.Errorf("expected ID %s, got %s", user.ID, found.ID)
		}
	})

	t.Run("FindByUsername not found", func(t *testing.T) {
		_, err := repos.Users.FindByUsername(context.Background(), "nonexistent")
		if err == nil {
			t.Error("expected error for nonexistent user")
		}
	})

	t.Run("List", func(t *testing.T) {
		cleanTables(t, db)
		newTestUser(t, repos, "listuser1", "developer")
		newTestUser(t, repos, "listuser2", "viewer")
		users, err := repos.Users.List(context.Background())
		if err != nil {
			t.Fatalf("List failed: %v", err)
		}
		if len(users) < 2 {
			t.Errorf("expected at least 2 users, got %d", len(users))
		}
	})
}

func TestHostRepo(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	repos := NewRepositories(db)
	cleanTables(t, db)
	user := newTestUser(t, repos, "hostowner", "admin")

	t.Run("Create and FindByID", func(t *testing.T) {
		host := &models.DockerHost{
			OwnerID:  user.ID,
			Name:     "test-host",
			HostIP:   "192.168.1.1",
			Port:     2375,
			Protocol: "tcp",
			AuthType: "none",
		}
		if err := repos.Hosts.Create(context.Background(), host); err != nil {
			t.Fatalf("Create failed: %v", err)
		}
		found, err := repos.Hosts.FindByID(context.Background(), host.ID)
		if err != nil {
			t.Fatalf("FindByID failed: %v", err)
		}
		if found.Name != host.Name {
			t.Errorf("expected name %q, got %q", host.Name, found.Name)
		}
	})

	t.Run("FindByOwner", func(t *testing.T) {
		hosts, err := repos.Hosts.FindByOwner(context.Background(), user.ID)
		if err != nil {
			t.Fatalf("FindByOwner failed: %v", err)
		}
		if len(hosts) == 0 {
			t.Error("expected at least one host")
		}
	})

	t.Run("ListAll", func(t *testing.T) {
		hosts, err := repos.Hosts.ListAll(context.Background())
		if err != nil {
			t.Fatalf("ListAll failed: %v", err)
		}
		if len(hosts) == 0 {
			t.Error("expected at least one host")
		}
	})

	t.Run("UpdateStatus", func(t *testing.T) {
		host := &models.DockerHost{
			OwnerID:  user.ID,
			Name:     "status-host",
			HostIP:   "10.0.0.1",
			Port:     2376,
			Protocol: "tcp",
			AuthType: "none",
		}
		repos.Hosts.Create(context.Background(), host)
		if err := repos.Hosts.UpdateStatus(context.Background(), host.ID, false); err != nil {
			t.Fatalf("UpdateStatus failed: %v", err)
		}
		found, _ := repos.Hosts.FindByID(context.Background(), host.ID)
		if found.IsActive {
			t.Error("expected is_active to be false")
		}
	})

	t.Run("Delete", func(t *testing.T) {
		host := &models.DockerHost{
			OwnerID:  user.ID,
			Name:     "delete-host",
			HostIP:   "10.0.0.2",
			Port:     2377,
			Protocol: "tcp",
			AuthType: "none",
		}
		repos.Hosts.Create(context.Background(), host)
		if err := repos.Hosts.Delete(context.Background(), host.ID); err != nil {
			t.Fatalf("Delete failed: %v", err)
		}
		_, err := repos.Hosts.FindByID(context.Background(), host.ID)
		if err == nil {
			t.Error("expected error finding deleted host")
		}
	})

	t.Run("FindByID not found", func(t *testing.T) {
		_, err := repos.Hosts.FindByID(context.Background(), uuid.New())
		if err == nil {
			t.Error("expected error for nonexistent host")
		}
	})
}

func TestConcurrentUserCreation(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	repos := NewRepositories(db)
	cleanTables(t, db)
	errCh := make(chan error, 10)

	for i := range 10 {
		go func(idx int) {
			user := &models.User{
				Username:     "concurrent" + string(rune('A'+idx)),
				Email:        "concurrent" + string(rune('A'+idx)) + "@repostest.com",
				PasswordHash: "hash",
				Role:         "developer",
			}
			errCh <- repos.Users.Create(context.Background(), user)
		}(i)
	}

	successes := 0
	for range 10 {
		if err := <-errCh; err == nil {
			successes++
		}
	}
	if successes != 10 {
		t.Errorf("expected 10 successful creations, got %d", successes)
	}
}