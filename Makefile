# FraudCell commands for macOS/Linux. On Windows use scripts\start-fraudcell.bat.
COMPOSE := docker compose --project-directory BACKEND -f BACKEND/docker-compose.yml

.PHONY: help up down reset ps logs seed demo demo-ai-down resilience security

help: ## List the commands
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-14s %s\n", $$1, $$2}'

BACKEND/.env:
	cp BACKEND/.env.example BACKEND/.env

up: BACKEND/.env ## Build and start everything; demo staff are seeded automatically
	$(COMPOSE) up -d --build
	@echo "FraudCell is starting at http://127.0.0.1:8080 (demo users: README.md)"

down: ## Stop everything, keep the data
	$(COMPOSE) down

reset: ## Stop everything and delete all data volumes
	$(COMPOSE) down -v

ps: ## Show container status
	$(COMPOSE) ps

logs: ## Follow the logs of every service
	$(COMPOSE) logs -f --tail=100

seed: ## Run the demo staff seed again
	$(COMPOSE) run --rm demo-seed

demo: ## Check the mandatory demo flow (case 11.3 steps 2-6)
	python3 scripts/demo.py smoke

demo-ai-down: ## Case 11.3 step 7: stop the AI and check that transactions still work
	$(COMPOSE) stop ai-service
	python3 scripts/demo.py ai-down; status=$$?; $(COMPOSE) start ai-service; exit $$status

resilience: ## Stop each container in turn (RabbitMQ too) and check the rest keeps working
	python3 scripts/demo.py resilience

security: ## Try the jury's attacks (case 10); logins from this IP are throttled for a minute after
	python3 scripts/security.py
