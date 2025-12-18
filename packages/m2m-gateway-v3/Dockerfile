ARG NODE_REGISTRY="docker.io"

FROM ${NODE_REGISTRY}/node:20.14.0-slim@sha256:5e8ac65a0231d76a388683d07ca36a9769ab019a85d85169fe28e206f7a3208e as build

RUN npm install -g corepack@0.31.0 && corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/
COPY .npmrc /app/

COPY ./packages/m2m-gateway-v3/package.json /app/packages/m2m-gateway-v3/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/api-clients/package.json /app/packages/api-clients/package.json
COPY ./packages/application-audit/package.json /app/packages/application-audit/package.json
COPY ./packages/kafka-iam-auth/package.json /app/packages/kafka-iam-auth/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/m2m-gateway-v3 /app/packages/m2m-gateway-v3
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/api-clients /app/packages/api-clients
COPY ./packages/application-audit /app/packages/application-audit
COPY ./packages/kafka-iam-auth /app/packages/kafka-iam-auth

RUN pnpm build && \
    rm -rf /app/node_modules/.modules.yaml && \
    rm -rf /app/node_modules/.cache && \
    mkdir /out && \
    cp -a --parents -t /out \
      node_modules packages/m2m-gateway-v3/node_modules \
      package*.json packages/m2m-gateway-v3/package*.json \
      packages/commons \
      packages/models \
      packages/api-clients  \
      packages/application-audit \
      packages/kafka-iam-auth \
      packages/m2m-gateway-v3/dist && \
    find /out -exec touch -h --date=@0 {} \;

FROM ${NODE_REGISTRY}/node:20.14.0-slim@sha256:5e8ac65a0231d76a388683d07ca36a9769ab019a85d85169fe28e206f7a3208e as final 

COPY --from=build /out /app

WORKDIR /app/packages/m2m-gateway-v3
EXPOSE 3000

CMD [ "node", "." ]