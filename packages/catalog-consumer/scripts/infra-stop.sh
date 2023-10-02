#!/bin/bash

docker compose -f ../../docker/docker-compose.yml stop zookeeper kafka connect readmodel mongo-express
