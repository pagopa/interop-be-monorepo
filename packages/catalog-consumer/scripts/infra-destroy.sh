#!/bin/bash

docker compose -f ../../docker/docker-compose.yml down zookeeper kafka connect readmodel mongo-express
