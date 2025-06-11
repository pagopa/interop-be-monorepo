# # #!/bin/bash
# # set -e

# # echo "Avvio dei container di test"
# # docker compose -f docker/docker-compose.test-env.yml up -d

# # echo "Attendo che PostgreSQL sia pronto"
# # until docker exec -it $(docker compose -f docker/docker-compose.test-env.yml ps -q postgres) pg_isready -U testuser >/dev/null 2>&1; do
# #   sleep 1
# # done
# # echo "PostgreSQL pronto"

# # echo "Attendo che MongoDB sia pronto"
# # until curl -s http://localhost:27017 >/dev/null 2>&1; do
# #   sleep 1
# # done
# # echo "MongoDB pronto"

# # SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# # DOCKER_COMPOSE_FILE="$SCRIPT_DIR/../docker/docker-compose.test-env.yml"

# # echo "Attendo che Redis sia pronto"
# # until docker compose -f "$DOCKER_COMPOSE_FILE" exec -T redis redis-cli ping | grep -q PONG; do
# #   sleep 1
# # done
# # echo "Redis pronto"


# # echo "Attendo che MinIO sia pronto"
# # until curl -s http://localhost:9000/minio/health/live >/dev/null 2>&1; do
# #   sleep 1
# # done
# # echo "MinIO pronto"

# # echo "Attendo che DynamoDB sia pronto"
# # until curl -s http://localhost:8000/shell >/dev/null 2>&1; do
# #   sleep 1
# # done
# # echo "DynamoDB pronto"

# # echo "Attendo che Mailpit sia pronto"
# # until curl -s http://localhost:8025/api/v1/messages >/dev/null 2>&1; do
# #   sleep 1
# # done
# # echo "Mailpit pronto"

# # echo "Attendo che LocalStack sia pronto"
# # until curl -s http://localhost:4566/health >/dev/null 2>&1; do
# #   sleep 1
# # done
# # echo "LocalStack pronto"

# # echo "🎉 Tutti i container di test sono pronti!"

# #!/bin/bash
# set -e

# SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# DOCKER_COMPOSE_FILE="$SCRIPT_DIR/../docker/docker-compose.test-env.yml"

# echo "Avvio dei container di test con docker-compose..."
# docker compose -f "$DOCKER_COMPOSE_FILE" up -d

# echo "Attendo che PostgreSQL sia pronto..."
# until docker compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres pg_isready -U testUser >/dev/null 2>&1; do
#   sleep 1
# done
# echo "PostgreSQL pronto"

# echo "Attendo che MongoDB sia pronto..."
# until curl -s http://localhost:27017 >/dev/null 2>&1; do
#   sleep 1
# done
# echo "MongoDB pronto"

# echo "Attendo che Redis sia pronto..."
# until docker compose -f "$DOCKER_COMPOSE_FILE" exec -T redis redis-cli ping | grep -q PONG; do
#   sleep 1
# done
# echo "Redis pronto"

# echo "Attendo che MinIO sia pronto..."
# until curl -s http://localhost:9000/minio/health/live >/dev/null 2>&1; do
#   sleep 1
# done
# echo "MinIO pronto"

# echo "Attendo che DynamoDB sia pronto..."
# until curl -s http://localhost:8000/shell >/dev/null 2>&1; do
#   sleep 1
# done
# echo "DynamoDB pronto"

# echo "Attendo che Mailpit sia pronto..."
# until curl -s http://localhost:8025/api/v1/messages >/dev/null 2>&1; do
#   sleep 1
# done
# echo "Mailpit pronto"

# echo "Attendo che LocalStack sia pronto..."
# until curl -s http://localhost:4566/health >/dev/null 2>&1; do
#   sleep 1
# done
# echo "LocalStack pronto"

# echo "🎉 Tutti i container di test sono pronti!"


#!/bin/bash
set -e

# Definisci il percorso del file docker-compose
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_COMPOSE_FILE="$SCRIPT_DIR/../docker/docker-compose.test-env.yml"

echo "Avvio dei container di test con docker-compose..."
docker compose -f "$DOCKER_COMPOSE_FILE" up -d

echo "Attendo che PostgreSQL (Event Store) sia pronto..."
# Utilizza il nome del servizio 'postgres' che è definito nel docker-compose.test-env.yml
until docker compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres pg_isready -U testUser >/dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL (Event Store) pronto"

echo "Attendo che MongoDB (Read Model) sia pronto..."
# Assicurati che l'healthcheck di MongoDB nel docker-compose sia efficace
until curl -s http://localhost:27017 >/dev/null 2>&1; do
  sleep 1
done
echo "MongoDB (Read Model) pronto"

echo "Attendo che PostgreSQL (Read Model SQL) sia pronto..."
# Utilizza il nome del servizio 'readmodel-sql-db' e la porta esposta '6002'
# Assicurati che l'utente 'testUser' e la porta '6002' siano corretti come configurati nel docker-compose
until docker compose -f "$DOCKER_COMPOSE_FILE" exec -T readmodel-sql pg_isready -U testUser -p 5433 >/dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL (Read Model SQL) pronto"

echo "Attendo che Redis sia pronto..."
until docker compose -f "$DOCKER_COMPOSE_FILE" exec -T redis redis-cli ping | grep -q PONG; do
  sleep 1
done
echo "Redis pronto"

echo "Attendo che MinIO sia pronto..."
until curl -s http://localhost:9000/minio/health/live >/dev/null 2>&1; do
  sleep 1
done
echo "MinIO pronto"

echo "Attendo che DynamoDB sia pronto..."
until curl -s http://localhost:8000/shell >/dev/null 2>&1; do
  sleep 1
done
echo "DynamoDB pronto"

echo "Attendo che Mailpit sia pronto..."
until curl -s http://localhost:8025/api/v1/messages >/dev/null 2>&1; do
  sleep 1
done
echo "Mailpit pronto"

echo "Attendo che LocalStack sia pronto..."
until curl -s http://localhost:4566/health >/dev/null 2>&1; do
  sleep 1
done
echo "LocalStack pronto"

echo "🎉 Tutti i container di test sono pronti!"