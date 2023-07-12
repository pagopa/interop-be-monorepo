#!/bin/bash

docker compose -f ./docker/docker-compose.yml up -d

# wait for debezium to be available on port 8083
while ! nc -z localhost 8083; do
  sleep 0.5
done

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

curl -i -X POST -H "Accept:application/json" -H "Content-Type:application/json" http://localhost:8083/connectors/ -d "@$SCRIPT_DIR/../register-postgres.json"
