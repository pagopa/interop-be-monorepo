#default value for compatibility
ARG NODE_REGISTRY="docker.io"

FROM ${NODE_REGISTRY}/node:20.19.3-slim@sha256:f8f6771d949ff351c061de64ef9cbfbc5949015883fb3b016b34aca6d0e5b8cc AS build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/
COPY .npmrc /app/

COPY ./packages/eservice-template-process/package.json /app/packages/eservice-template-process/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/api-clients/package.json /app/packages/api-clients/package.json
COPY ./packages/application-audit/package.json /app/packages/application-audit/package.json
COPY ./packages/kafka-iam-auth/package.json /app/packages/kafka-iam-auth/package.json
COPY ./packages/readmodel/package.json /app/packages/readmodel/package.json
COPY ./packages/readmodel-models/package.json /app/packages/readmodel-models/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/eservice-template-process /app/packages/eservice-template-process
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/api-clients /app/packages/api-clients
COPY ./packages/application-audit /app/packages/application-audit
COPY ./packages/kafka-iam-auth /app/packages/kafka-iam-auth
COPY ./packages/readmodel /app/packages/readmodel
COPY ./packages/readmodel-models /app/packages/readmodel-models

RUN pnpm build && \
  rm -rf /app/node_modules/.modules.yaml && \
  rm -rf /app/node_modules/.cache && \
  mkdir /out && \
  cp -a --parents -t /out \
  node_modules packages/eservice-template-process/node_modules \
  package*.json packages/eservice-template-process/package*.json \
  packages/commons \
  packages/models \
  packages/api-clients \
  packages/application-audit \
  packages/kafka-iam-auth \
  packages/readmodel/ \
  packages/readmodel-models/ \
  packages/eservice-template-process/dist && \
  find /out -exec touch -h --date=@0 {} \;

FROM ${NODE_REGISTRY}/node:20.19.3-slim@sha256:f8f6771d949ff351c061de64ef9cbfbc5949015883fb3b016b34aca6d0e5b8cc AS final

COPY --from=build /out /app

WORKDIR /app/packages/eservice-template-process
EXPOSE 3000

CMD [ "node", "." ]
