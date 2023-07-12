#!/bin/bash

docker compose -f ./docker/docker-compose.yml up -d

# wait until debezium is available
while [[ "$(curl -s -o /dev/null -w ''%{http_code}'' localhost:8083/connectors/)" != "200" ]]; do
 sleep 1;
done

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# this initially returns 400 until some other services have been propagated internally, so we retry until we either get a 200 or a 409 (in case the connector was already registered)
while [[ "$(curl -s -o /dev/null -i -X POST -H "Accept:application/json" -H "Content-Type:application/json" http://localhost:8083/connectors/ -d "@$SCRIPT_DIR/../register-postgres.json")" == "400" ]]; do
  sleep 1;
done;


