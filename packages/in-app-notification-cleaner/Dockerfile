#default value for compatibility
ARG NODE_REGISTRY="docker.io"

FROM ${NODE_REGISTRY}/node:20.14.2-slim@sha256:28b60cb146050237486e1d34b8e3299761d95db2013d7184a44b09f47904059d AS build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/
COPY .npmrc /app/

COPY ./packages/in-app-notification-cleaner/package.json /app/packages/in-app-notification-cleaner/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/in-app-notification-db-models/package.json /app/packages/in-app-notification-db-models/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/in-app-notification-cleaner /app/packages/in-app-notification-cleaner
COPY ./packages/commons /app/packages/commons
COPY ./packages/in-app-notification-db-models /app/packages/in-app-notification-db-models

RUN pnpm build && \
  rm -rf /app/node_modules/.modules.yaml && \
  rm -rf /app/node_modules/.cache && \
  mkdir /out && \
  cp -a --parents -t /out \
  node_modules packages/in-app-notification-cleaner/node_modules \
  package*.json packages/in-app-notification-cleaner/package*.json \
  packages/commons \
  packages/in-app-notification-db-models \
  packages/in-app-notification-cleaner/dist && \
  find /out -exec touch -h --date=@0 {} \;

FROM ${NODE_REGISTRY}/node:20.14.2-slim@sha256:28b60cb146050237486e1d34b8e3299761d95db2013d7184a44b09f47904059d AS final

COPY --from=build /out /app

RUN groupadd -r app && useradd -rm -g app app
RUN chown -R app:app /app && chmod -R 700 /app
USER app

WORKDIR /app/packages/in-app-notification-cleaner
EXPOSE 3000

CMD ["node", "."]
