#default value for compatibility
ARG NODE_REGISTRY="docker.io"

FROM ${NODE_REGISTRY}/node:20.19.4-slim@sha256:ef358d9fa0734e2c3b42482aa352c28a59245bc3d32e07ef57810cf8ba9092c5 AS build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/
COPY .npmrc /app/

COPY ./packages/m2m-event-dispatcher/package.json /app/packages/m2m-event-dispatcher/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/kafka-iam-auth/package.json /app/packages/kafka-iam-auth/package.json
COPY ./packages/readmodel/package.json /app/packages/readmodel/package.json
COPY ./packages/readmodel-models/package.json /app/packages/readmodel-models/package.json
COPY ./packages/m2m-event-db-models/package.json /app/packages/m2m-event-db-models/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/

COPY ./packages/m2m-event-dispatcher /app/packages/m2m-event-dispatcher
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/kafka-iam-auth /app/packages/kafka-iam-auth
COPY ./packages/readmodel /app/packages/readmodel
COPY ./packages/readmodel-models /app/packages/readmodel-models
COPY ./packages/m2m-event-db-models /app/packages/m2m-event-db-models

RUN pnpm build && \
  rm -rf /app/node_modules/.modules.yaml && \
  rm -rf /app/node_modules/.cache && \
  mkdir /out && \
  cp -a --parents -t /out \
  node_modules packages/m2m-event-dispatcher/node_modules \
  package*.json packages/m2m-event-dispatcher/package*.json \
  packages/commons \
  packages/models \
  packages/kafka-iam-auth \
  packages/readmodel/ \
  packages/readmodel-models/ \    
  packages/m2m-event-db-models/ \
  packages/m2m-event-dispatcher/dist && \
  find /out -exec touch -h --date=@0 {} \;

FROM ${NODE_REGISTRY}/node:20.19.4-slim@sha256:ef358d9fa0734e2c3b42482aa352c28a59245bc3d32e07ef57810cf8ba9092c5 AS final

COPY --from=build /out /app

WORKDIR /app/packages/m2m-event-dispatcher
EXPOSE 3000

CMD ["node", "."]
