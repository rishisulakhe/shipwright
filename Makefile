.PHONY: dev-up dev-down dev-logs backend-shell db-reset clean

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
