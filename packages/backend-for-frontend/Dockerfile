#default value for compatibility
ARG NODE_REGISTRY="docker.io"

FROM ${NODE_REGISTRY}/node:20.19.3-slim@sha256:f8f6771d949ff351c061de64ef9cbfbc5949015883fb3b016b34aca6d0e5b8cc AS build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/
COPY .npmrc /app/

COPY ./packages/backend-for-frontend/package.json /app/packages/backend-for-frontend/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/api-clients/package.json /app/packages/api-clients/package.json
COPY ./packages/agreement-lifecycle/package.json /app/packages/agreement-lifecycle/package.json
COPY ./packages/client-assertion-validation/package.json /app/packages/client-assertion-validation/package.json
COPY ./packages/application-audit/package.json /app/packages/application-audit/package.json
COPY ./packages/kafka-iam-auth/package.json /app/packages/kafka-iam-auth/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/backend-for-frontend /app/packages/backend-for-frontend
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/api-clients /app/packages/api-clients
COPY ./packages/agreement-lifecycle /app/packages/agreement-lifecycle
COPY ./packages/client-assertion-validation /app/packages/client-assertion-validation
COPY ./packages/application-audit /app/packages/application-audit
COPY ./packages/kafka-iam-auth /app/packages/kafka-iam-auth

RUN pnpm build && \
  rm -rf /app/node_modules/.modules.yaml && \
  rm -rf /app/node_modules/.cache && \
  mkdir /out && \
  cp -a --parents -t /out \
  node_modules packages/backend-for-frontend/node_modules \
  package*.json packages/backend-for-frontend/package*.json \
  packages/commons \
  packages/models \
  packages/api-clients  \
  packages/agreement-lifecycle \
  packages/client-assertion-validation \
  packages/application-audit \
  packages/kafka-iam-auth \
  packages/backend-for-frontend/dist && \
  find /out -exec touch -h --date=@0 {} \;

FROM ${NODE_REGISTRY}/node:20.19.3-slim@sha256:f8f6771d949ff351c061de64ef9cbfbc5949015883fb3b016b34aca6d0e5b8cc AS final

COPY --from=build /out /app

WORKDIR /app/packages/backend-for-frontend
EXPOSE 3000

CMD [ "node", "." ]
