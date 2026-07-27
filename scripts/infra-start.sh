#!/bin/bash

docker compose -f docker/docker-compose.yml up -d

# wait until debezium is available
while [[ "$(curl -s -o /dev/null -w ''%{http_code}'' localhost:8083/connectors/)" != "200" ]]; do
  sleep 1
done

URL="http://localhost:8083/connectors/"

# We need to wait until the service db to be available (whenever we stop getting 400 we know it's up)
while true; do
  response=$(curl -s -o /dev/null -i -X POST -H "Accept:application/json" -H "Content-Type:application/json" -w "%{http_code}\n" -d "@register-connector-postgres.json" "$URL")

  if [ "$response" -eq "201" ]; then
    echo "Connector registered successfully"
    break
  elif [ "$response" -eq "409" ]; then
    echo "Connector already registered. Moving on."
    break
  else
    sleep 1
  fi
done

