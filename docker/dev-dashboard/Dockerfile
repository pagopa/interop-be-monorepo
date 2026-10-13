FROM docker:29-cli AS docker-cli
FROM mcr.microsoft.com/devcontainers/typescript-node:1-20-bookworm

ENV npm_config_store_dir=/home/node/.local/share/pnpm/store \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PLAYWRIGHT_BROWSERS_PATH=/home/node/.cache/ms-playwright

# Debian Chromium is available on both amd64 and arm64. The same image provides
# the fullstack devcontainer tools without tying the runtime to VS Code.
RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium curl jq socat gosu \
    && corepack enable \
    && corepack prepare pnpm@10.29.3 --activate \
    && npx --yes playwright@1.61.1 install-deps chromium \
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

EXPOSE 8076
