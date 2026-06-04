.PHONY: dev-up dev-down dev-logs backend-shell db-reset clean prod-build prod-up prod-down prod-logs test test-cover test-integration

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

prod-build:
	docker-compose -f docker-compose.prod.yaml build

prod-up:
	docker-compose -f docker-compose.prod.yaml --env-file .env.production up -d --build

prod-down:
	docker-compose -f docker-compose.prod.yaml down

prod-logs:
	docker-compose -f docker-compose.prod.yaml logs -f

test:
	cd backend && go test ./... -v -count=1 -timeout 60s

test-cover:
	cd backend && go test ./... -coverprofile=coverage.out -timeout 60s && go tool cover -html=coverage.out -o coverage.html && echo "Coverage report generated: coverage.html"

test-integration:
	cd backend && go test -tags=integration ./... -v -count=1 -timeout 120s
