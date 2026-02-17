#default value for compatibility
ARG NODE_REGISTRY="docker.io"


FROM ${NODE_REGISTRY}/node:20.19.4-slim@sha256:6db5e436948af8f0244488a1f658c2c8e55a3ae51ca2e1686ed042be8f25f70a AS build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/
COPY .npmrc /app/

COPY ./packages/m2m-event-cleaner/package.json /app/packages/m2m-event-cleaner/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/m2m-event-db-models/package.json /app/packages/m2m-event-db-models/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/m2m-event-cleaner /app/packages/m2m-event-cleaner
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/m2m-event-db-models /app/packages/m2m-event-db-models

ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm build && \
  rm -rf /app/node_modules/.modules.yaml && \
  rm -rf /app/node_modules/.cache && \
  mkdir /out && \
  cp -a --parents -t /out \
  node_modules packages/m2m-event-cleaner/node_modules \
  package*.json packages/m2m-event-cleaner/package*.json \
  packages/commons \
  packages/models \
  packages/m2m-event-db-models \
  packages/m2m-event-cleaner/dist && \
  find /out -exec touch -h --date=@0 {} \;

FROM ${NODE_REGISTRY}/node:20.19.4-slim@sha256:6db5e436948af8f0244488a1f658c2c8e55a3ae51ca2e1686ed042be8f25f70a AS final

COPY --from=build /out /app

RUN groupadd -r app && useradd -rm -g app app
RUN chown -R app:app /app && chmod -R 700 /app
USER app

WORKDIR /app/packages/m2m-event-cleaner
EXPOSE 3000

CMD ["node", "."]
