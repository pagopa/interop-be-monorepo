#default value for compatibility
ARG NODE_REGISTRY="docker.io"

FROM ${NODE_REGISTRY}/node:20.19.4-slim@sha256:ef358d9fa0734e2c3b42482aa352c28a59245bc3d32e07ef57810cf8ba9092c5 AS build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/
COPY .npmrc /app/

COPY ./packages/client-purpose-updater/package.json /app/packages/client-purpose-updater/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/kafka-iam-auth/package.json /app/packages/kafka-iam-auth/package.json
COPY ./packages/api-clients/package.json /app/packages/api-clients/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/client-purpose-updater /app/packages/client-purpose-updater
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/kafka-iam-auth /app/packages/kafka-iam-auth
COPY ./packages/api-clients /app/packages/api-clients

RUN pnpm build && \
  rm -rf /app/node_modules/.modules.yaml && \
  rm -rf /app/node_modules/.cache && \
  mkdir /out && \
  cp -a --parents -t /out \
  node_modules packages/client-purpose-updater/node_modules \
  package*.json packages/client-purpose-updater/package*.json \
  packages/commons \
  packages/models \
  packages/kafka-iam-auth \
  packages/api-clients \
  packages/client-purpose-updater/dist && \
  find /out -exec touch -h --date=@0 {} \;

FROM ${NODE_REGISTRY}/node:20.19.4-slim@sha256:ef358d9fa0734e2c3b42482aa352c28a59245bc3d32e07ef57810cf8ba9092c5 AS final

COPY --from=build /out /app

RUN groupadd -r app && useradd -rm -g app app
RUN chown -R app:app /app && chmod -R 700 /app
USER app

WORKDIR /app/packages/client-purpose-updater
EXPOSE 3000

CMD ["node", "."]
