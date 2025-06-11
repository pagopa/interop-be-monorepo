# #!/bin/bash

# # Questo script ferma ed elimina i container Docker definiti in docker-compose.test-env.yml
# # e rimuove tutti i volumi persistenti associati.

# # Interrompi lo script se un comando fallisce
# set -e

# # Definisci il percorso del file docker-compose
# # Assicurati che SCRIPT_DIR sia impostato correttamente rispetto al tuo file docker-compose.test-env.yml
# SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# DOCKER_COMPOSE_FILE="$SCRIPT_DIR/../docker/docker-compose.test-env.yml"

# echo "Sto fermando ed eliminando i container Docker e i relativi volumi per $DOCKER_COMPOSE_FILE..."

# # Verifica se il file docker-compose esiste
# if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
#     echo "Errore: Il file docker-compose.test-env.yml non trovato al percorso: $DOCKER_COMPOSE_FILE"
#     echo "Assicurati che lo script sia eseguito dalla directory corretta o che il percorso sia impostato correttamente."
#     exit 1
# fi

# # Ferma ed elimina i container, le reti e i volumi
# # L'opzione --volumes (o -v) è quella che elimina i volumi nominati.
# # L'opzione --remove-orphans elimina i servizi i cui container non sono più definiti nel compose file.
# docker compose -f "$DOCKER_COMPOSE_FILE" down --volumes --remove-orphans

# echo "Pulizia completata: container, reti e volumi sono stati rimossi."
# echo "Ora puoi avviare un nuovo ambiente di test pulito."

# exit 0


#!/bin/bash

# Questo script ferma ed elimina i container Docker definiti in docker-compose.test-env.yml
# e rimuove tutti i volumi persistenti associati.

# Interrompi lo script se un comando fallisce
set -e

# Definisci il percorso del file docker-compose
# Assicurati che SCRIPT_DIR sia impostato correttamente rispetto al tuo file docker-compose.test-env.yml
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_COMPOSE_FILE="$SCRIPT_DIR/../docker/docker-compose.test-env.yml"

echo "Sto fermando ed eliminando i container Docker e i relativi volumi per $DOCKER_COMPOSE_FILE..."

# Verifica se il file docker-compose esiste
if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
    echo "Errore: Il file docker-compose.test-env.yml non trovato al percorso: $DOCKER_COMPOSE_FILE"
    echo "Assicurati che lo script sia eseguito dalla directory corretta o che il percorso sia impostato correttamente."
    exit 1
fi

# Ferma ed elimina i container, le reti e i volumi
# L'opzione --volumes (o -v) è quella che elimina i volumi nominati.
# L'opzione --remove-orphans elimina i servizi i cui container non sono più definiti nel compose file.
docker compose -f "$DOCKER_COMPOSE_FILE" down --volumes --remove-orphans

echo "Pulizia completata: container, reti e volumi sono stati rimossi."
echo "Ora puoi avviare un nuovo ambiente di test pulito."

exit 0