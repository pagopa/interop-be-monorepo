FROM node:20.14.0-slim@sha256:5e8ac65a0231d76a388683d07ca36a9769ab019a85d85169fe28e206f7a3208e as build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/

COPY ./packages/bff/package.json /app/packages/bff/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/selfcare-v2-client/package.json /app/packages/selfcare-v2-client/package.json
COPY ./packages/api-clients/package.json /app/packages/api-clients/package.json
COPY ./packages/agreement-lifecycle/package.json /app/packages/agreement-lifecycle/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/bff /app/packages/bff
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/selfcare-v2-client /app/packages/selfcare-v2-client
COPY ./packages/api-clients /app/packages/api-clients
COPY ./packages/agreement-lifecycle /app/packages/agreement-lifecycle

RUN pnpm build && \
    rm -rf /app/node_modules/.modules.yaml && \
    rm -rf /app/node_modules/.cache && \
    mkdir /out && \
    cp -a --parents -t /out \
      node_modules packages/bff/node_modules \
      package*.json packages/bff/package*.json \
      packages/commons \
      packages/models \
      packages/selfcare-v2-client \
      packages/api-clients  \
      packages/agreement-lifecycle \
      packages/bff/dist && \
    find /out -exec touch -h --date=@0 {} \;

FROM node:20.14.0-slim@sha256:5e8ac65a0231d76a388683d07ca36a9769ab019a85d85169fe28e206f7a3208e as final 

COPY --from=build /out /app

WORKDIR /app/packages/bff
EXPOSE 3000

CMD [ "node", "." ]
