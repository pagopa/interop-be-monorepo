#default value for compatibility
ARG NODE_REGISTRY="docker.io"

FROM ${NODE_REGISTRY}/node:20.19.3-slim@sha256:f8f6771d949ff351c061de64ef9cbfbc5949015883fb3b016b34aca6d0e5b8cc AS build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/
COPY .npmrc /app/

COPY ./packages/authorization-server/package.json /app/packages/authorization-server/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/client-assertion-validation/package.json /app/packages/client-assertion-validation/package.json
COPY ./packages/dpop-validation/package.json /app/packages/dpop-validation/package.json
COPY ./packages/kafka-iam-auth/package.json /app/packages/kafka-iam-auth/package.json
COPY ./packages/api-clients/package.json /app/packages/api-clients/package.json
COPY ./packages/application-audit/package.json /app/packages/application-audit/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/authorization-server /app/packages/authorization-server
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/client-assertion-validation /app/packages/client-assertion-validation
COPY ./packages/dpop-validation /app/packages/dpop-validation
COPY ./packages/kafka-iam-auth /app/packages/kafka-iam-auth
COPY ./packages/api-clients /app/packages/api-clients
COPY ./packages/application-audit /app/packages/application-audit

RUN pnpm build && \
  rm -rf /app/node_modules/.modules.yaml && \
  rm -rf /app/node_modules/.cache && \
  mkdir /out && \
  cp -a --parents -t /out \
  node_modules packages/authorization-server/node_modules \
  package*.json packages/authorization-server/package*.json \
  packages/commons/ \
  packages/models/ \
  packages/client-assertion-validation/ \
  packages/dpop-validation/ \
  packages/kafka-iam-auth/ \
  packages/api-clients \
  packages/application-audit \
  packages/authorization-server/dist && \
  find /out -exec touch -h --date=@0 {} \;

FROM ${NODE_REGISTRY}/node:20.19.3-slim@sha256:f8f6771d949ff351c061de64ef9cbfbc5949015883fb3b016b34aca6d0e5b8cc AS final

COPY --from=build /out /app

WORKDIR /app/packages/authorization-server
EXPOSE 3300

CMD [ "node", "." ]
