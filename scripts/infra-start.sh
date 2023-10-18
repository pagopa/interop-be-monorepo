#!/bin/bash

docker compose -f ../../docker/docker-compose.yml up -d 

# wait until debezium is available
while [[ "$(curl -s -o /dev/null -w ''%{http_code}'' localhost:8083/connectors/)" != "200" ]]; do
 sleep 1;
done


function register_connector () {
  local SERVICE_NAME="$1"
  local CONNECTOR_PATH="$2"
  local URL="http://localhost:8083/connectors/"
  local SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

  # We need to wait until the service db to be available (whenever we stop getting 400 we know it's up)
  while true; do
    local response=$(curl -s -o /dev/null -i -X POST -H "Accept:application/json" -H "Content-Type:application/json" -w "%{http_code}\n" -d "@$SCRIPT_DIR/$CONNECTOR_PATH" "$URL")

    if [ "$response" -eq "201" ]; then
      echo "$SERVICE_NAME connector registered successfully"
      break
    elif [ "$response" -eq "409" ]; then
      echo "$SERVICE_NAME connector already registered. Moving on."
      break
    else
      sleep 1
    fi
  done
}

register_connector "Catalog" "packages/catalog-consumer/register-catalog-postgres.json"
