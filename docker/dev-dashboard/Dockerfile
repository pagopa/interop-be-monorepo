FROM docker:29-cli AS docker-cli
FROM mcr.microsoft.com/devcontainers/typescript-node:1-20-bookworm

ENV npm_config_store_dir=/home/node/.local/share/pnpm/store \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Debian Chromium supports the backend documents generator on amd64 and arm64.
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium curl jq socat gosu \
    && corepack enable \
    && corepack prepare pnpm@10.29.3 --activate \
    && rm -rf /var/lib/apt/lists/*

COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose
COPY docker/dev-dashboard/entrypoint.sh /usr/local/bin/dashboard-entrypoint
RUN chmod +x /usr/local/bin/dashboard-entrypoint

# The devcontainer base also ships a global pnpm. Use Corepack's selected
# workspace version instead of allowing that binary to shadow its shim.
RUN npm uninstall -g pnpm \
    && corepack enable \
    && corepack prepare pnpm@10.29.3 --activate

# Bootstrap has only dotenv-flow as a runtime dependency. It can inspect a fresh
# checkout before the main container installs or builds the application workspace.
RUN --mount=type=bind,target=/build-context,readonly \
    --mount=type=cache,target=/home/node/.local/share/pnpm/store \
    node /build-context/docker/dev-dashboard/stage-bootstrap.mjs /build-context /opt/dashboard-bootstrap \
    && cd /opt/dashboard-bootstrap \
    && CI=true pnpm install --filter=pagopa-interop-dev-dashboard-bootstrap --prod --frozen-lockfile --ignore-scripts

EXPOSE 8076
