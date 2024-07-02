FROM node:20.14.0-slim@sha256:5e8ac65a0231d76a388683d07ca36a9769ab019a85d85169fe28e206f7a3208e as build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/

COPY ./packages/eservice-descriptors-archiver/package.json /app/packages/eservice-descriptors-archiver/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/kafka-iam-auth/package.json /app/packages/kafka-iam-auth/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/eservice-descriptors-archiver /app/packages/eservice-descriptors-archiver
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/kafka-iam-auth /app/packages/kafka-iam-auth
COPY ./packages/catalog-process/open-api/catalog-service-spec.yml /app/packages/catalog-process/open-api/catalog-service-spec.yml

RUN pnpm build && \
    rm -rf /app/node_modules/.modules.yaml && \
    rm -rf /app/node_modules/.cache && \
    mkdir /out && \
    cp -a --parents -t /out \
      node_modules packages/eservice-descriptors-archiver/node_modules \
      package*.json packages/eservice-descriptors-archiver/package*.json \
      packages/commons \
      packages/models \
      packages/kafka-iam-auth \
      packages/eservice-descriptors-archiver/dist && \
    find /out -exec touch -h --date=@0 {} \;

FROM node:20.14.0-slim@sha256:5e8ac65a0231d76a388683d07ca36a9769ab019a85d85169fe28e206f7a3208e as final

COPY --from=build /out /app

WORKDIR /app/packages/eservice-descriptors-archiver
EXPOSE 3000

CMD ["node", "."]
