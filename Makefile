.PHONY: dev logs shell down build backup restore deploy-rpi migrate migration

COMPOSE_DEV := docker compose -f docker-compose.dev.yml
COMPOSE_PROD := docker compose -f docker-compose.yml

dev:
	$(COMPOSE_DEV) up --build

logs:
	$(COMPOSE_DEV) logs -f

shell:
	docker exec -it dashboard-dev /bin/bash

down:
	$(COMPOSE_DEV) down

build:
	$(COMPOSE_PROD) build

migrate:
	docker exec -it dashboard-dev sh -c "cd /app/backend && alembic upgrade head"

migration:
	docker exec -it dashboard-dev sh -c "cd /app/backend && alembic revision --autogenerate -m \"$(name)\""

backup:
	bash scripts/backup.sh

restore:
	bash scripts/restore.sh $(file)

deploy-rpi:
	bash scripts/deploy-rpi.sh
