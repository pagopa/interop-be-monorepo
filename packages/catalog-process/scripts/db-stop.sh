#!/bin/bash

docker compose -f ../../docker/docker-compose.yml stop catalog-event-store pg-admin readmodel
