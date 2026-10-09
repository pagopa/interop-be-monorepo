#!/bin/sh
set -eu

# libpq ignores password files that are readable by other users.
cp /pgadmin4/pgpass-source /var/lib/pgadmin/pgpass
chmod 600 /var/lib/pgadmin/pgpass

# Use the image's initialization and first-launch server import.
exec /entrypoint.sh
