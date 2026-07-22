#!/bin/sh
set -eu

architecture_option=""
if [ "$(uname -m)" = "x86_64" ]; then
  architecture_option="-Dos.arch=amd64"
fi

exec java $architecture_option \
  -Djava.library.path=./DynamoDBLocal_lib \
  -jar DynamoDBLocal.jar "$@"
