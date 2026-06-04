package testhelpers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/lib/pq"
	"github.com/rishisulakhe/shipwright/backend/internal/auth"
	"github.com/rishisulakhe/shipwright/backend/internal/repository"
)

const (
	TestDBURL    = "postgres://dduser:ddpass@localhost:5432/dockerdash_test?sslmode=disable"
	TestJWTSecret = "test-jwt-secret-key-for-testing"
)

func SetupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("postgres", TestDBURL)
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}
	if err := db.Ping(); err != nil {
		t.Fatalf("failed to ping test database: %v", err)
	}
	return db
}

func RunMigrations(t *testing.T) {
	t.Helper()
	migrationsPath := findMigrationsPath(t)
	m, err := migrate.New("file://"+migrationsPath, TestDBURL)
	if err != nil {
		t.Fatalf("failed to create migrator: %v", err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("failed to run migrations: %v", err)
	}
	sourceErr, dbErr := m.Close()
	if sourceErr != nil || dbErr != nil {
		t.Logf("migration close warnings: source=%v, db=%v", sourceErr, dbErr)
	}
}

func CleanTestDB(t *testing.T, db *sql.DB) {
	t.Helper()
	tables := []string{"images", "volumes", "networks", "containers", "docker_hosts", "users"}
	for _, table := range tables {
		db.Exec("DELETE FROM " + table)
	}
}

func TeardownTestDB(t *testing.T, db *sql.DB) {
	t.Helper()
	if db != nil {
		db.Close()
	}
}

func findMigrationsPath(t *testing.T) string {
	t.Helper()
	wd, _ := os.Getwd()
	for dir := wd; dir != "/"; dir = filepath.Dir(dir) {
		path := filepath.Join(dir, "migrations")
		if entries, err := os.ReadDir(path); err == nil && len(entries) > 0 {
			return path
		}
	}
	t.Fatal("could not find migrations directory")
	return ""
}

func NewTestRepos(t *testing.T) (*repository.Repositories, *sql.DB) {
	t.Helper()
	db := SetupTestDB(t)
	RunMigrations(t)
	CleanTestDB(t, db)
	return repository.NewRepositories(db), db
}

func GenerateTestToken(userID, username, role string) string {
	token, _ := auth.GenerateAccessToken(userID, username, role, []byte(TestJWTSecret))
	return token
}

func MakeRequest(method, url string, body interface{}, token string) *http.Request {
	var bodyReader io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		bodyReader = bytes.NewReader(data)
	}
	req := httptest.NewRequest(method, url, bodyReader)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return req
}

func DecodeResponse(t *testing.T, resp *http.Response, target interface{}) {
	t.Helper()
	defer resp.Body.Close()
	if err := json.NewDecoder(resp.Body).Decode(target); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
}

func DecodeError(t *testing.T, resp *http.Response) string {
	t.Helper()
	defer resp.Body.Close()
	var errResp map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&errResp); err != nil {
		t.Fatalf("failed to decode error response: %v", err)
	}
	return errResp["error"]
}

func ExecuteRequest(handler http.Handler, req *http.Request) *http.Response {
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	return rr.Result()
}

func FormatURL(format string, args ...interface{}) string {
	return fmt.Sprintf(format, args...)
}