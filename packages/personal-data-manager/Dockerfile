#default value for compatibility
ARG NODE_REGISTRY="docker.io"

FROM ${NODE_REGISTRY}/node:20.19.4-slim@sha256:6db5e436948af8f0244488a1f658c2c8e55a3ae51ca2e1686ed042be8f25f70a AS build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/
COPY .npmrc /app/

COPY ./packages/personal-data-manager/package.json /app/packages/personal-data-manager/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/api-clients/package.json /app/packages/api-clients/package.json
COPY ./packages/application-audit/package.json /app/packages/application-audit/package.json
COPY ./packages/kafka-iam-auth/package.json /app/packages/kafka-iam-auth/package.json
COPY ./packages/readmodel/package.json /app/packages/readmodel/package.json
COPY ./packages/readmodel-models/package.json /app/packages/readmodel-models/package.json
COPY ./packages/personal-data-db-models/package.json /app/packages/personal-data-db-models/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/personal-data-manager /app/packages/personal-data-manager
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/api-clients /app/packages/api-clients
COPY ./packages/application-audit /app/packages/application-audit
COPY ./packages/kafka-iam-auth /app/packages/kafka-iam-auth
COPY ./packages/readmodel /app/packages/readmodel
COPY ./packages/readmodel-models /app/packages/readmodel-models
COPY ./packages/personal-data-db-models /app/packages/personal-data-db-models

ARG NODE_HEAP_SIZE=4096
RUN NODE_OPTIONS="--max-old-space-size=${NODE_HEAP_SIZE}" pnpm build && \
  rm -rf /app/node_modules/.modules.yaml && \
  rm -rf /app/node_modules/.cache && \
  mkdir /out && \
  cp -a --parents -t /out \
  node_modules packages/personal-data-manager/node_modules \
  package*.json packages/personal-data-manager/package*.json \
  packages/commons \
  packages/models \
  packages/api-clients \
  packages/application-audit \
  packages/kafka-iam-auth \
  packages/readmodel/ \
  packages/readmodel-models/ \
  packages/personal-data-db-models/ \
  packages/personal-data-manager/dist && \
  find /out -exec touch -h --date=@0 {} \;

FROM ${NODE_REGISTRY}/node:20.19.4-slim@sha256:6db5e436948af8f0244488a1f658c2c8e55a3ae51ca2e1686ed042be8f25f70a AS final

COPY --from=build /out /app

RUN groupadd -r app && useradd -rm -g app app
RUN chown -R app:app /app && chmod -R 700 /app
USER app

WORKDIR /app/packages/personal-data-manager
EXPOSE 3000

CMD [ "node", "." ]
