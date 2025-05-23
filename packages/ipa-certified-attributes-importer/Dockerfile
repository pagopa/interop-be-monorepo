#default value for compatibility
ARG NODE_REGISTRY="docker.io"

FROM ${NODE_REGISTRY}/node:20.14.0-slim@sha256:5e8ac65a0231d76a388683d07ca36a9769ab019a85d85169fe28e206f7a3208e as build

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/
COPY .npmrc /app/

COPY ./packages/ipa-certified-attributes-importer/package.json /app/packages/ipa-certified-attributes-importer/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/api-clients/package.json /app/packages/api-clients/package.json
COPY ./packages/readmodel/package.json /app/packages/readmodel/package.json
COPY ./packages/readmodel-models/package.json /app/packages/readmodel-models/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/ipa-certified-attributes-importer /app/packages/ipa-certified-attributes-importer/
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/api-clients /app/packages/api-clients
COPY ./packages/readmodel /app/packages/readmodel
COPY ./packages/readmodel-models /app/packages/readmodel-models

RUN pnpm build && \
    rm -rf /app/node_modules/.modules.yaml && \
    rm -rf /app/node_modules/.cache && \
    mkdir /out && \
    cp -a --parents -t /out \
    node_modules packages/ipa-certified-attributes-importer/node_modules \
    package*.json packages/ipa-certified-attributes-importer/package*.json \
    packages/commons/ \
    packages/models/ \
    packages/api-clients \
    packages/readmodel/ \
    packages/readmodel-models/ \  
    packages/ipa-certified-attributes-importer/dist && \
    find /out -exec touch -h --date=@0 {} \;

FROM ${NODE_REGISTRY}/node:20.14.0-slim@sha256:5e8ac65a0231d76a388683d07ca36a9769ab019a85d85169fe28e206f7a3208e as final 

COPY --from=build /out /app

WORKDIR /app/packages/ipa-certified-attributes-importer
EXPOSE 3000

CMD [ "node", "." ]
