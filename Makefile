.PHONY: dev-up dev-down dev-logs backend-shell db-reset clean prod-build prod-up prod-down prod-logs test test-cover test-integration lint lint-frontend lint-backend

dev-up:
	docker-compose up -d --build

dev-down:
	docker-compose down

dev-logs:
	docker-compose logs -f

backend-shell:
	docker-compose exec backend sh

db-reset:
	docker-compose down -v
	docker-compose up -d db
	sleep 5
	docker-compose exec db psql -U dduser -d dockerdash -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

clean:
	docker-compose down -v
	docker-compose rm -f
	docker image prune -f

test:
	cd backend && go test ./... -v -count=1 -timeout 60s

test-cover:
	cd backend && go test ./... -coverprofile=coverage.out -timeout 60s && go tool cover -html=coverage.out -o coverage.html && echo "Coverage report generated: coverage.html"

test-integration:
	cd backend && go test -tags=integration ./... -v -count=1 -timeout 120s

lint: lint-backend lint-frontend

lint-backend:
	cd backend && golangci-lint run ./... --timeout=5m

lint-frontend:
	cd frontend && npm run lint

lint-frontend-fix:
	cd frontend && npx eslint . --fix
