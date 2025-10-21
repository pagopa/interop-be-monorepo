#default value for compatibility
ARG NODE_REGISTRY="docker.io"

FROM ${NODE_REGISTRY}/node:20.19.4-slim@sha256:ef358d9fa0734e2c3b42482aa352c28a59245bc3d32e07ef57810cf8ba9092c5 AS build 

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/
COPY .npmrc /app/

COPY ./packages/signed-objects-persister/package.json /app/packages/signed-objects-persister/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/

COPY ./packages/signed-objects-persister /app/packages/signed-objects-persister
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models

RUN pnpm build && \
    rm -rf /app/node_modules/.modules.yaml && \
    rm -rf /app/node_modules/.cache && \
    mkdir /out && \
    cp -a --parents -t /out \
    node_modules packages/signed-objects-persister/node_modules \
    package*.json packages/signed-objects-persister/package*.json \
    packages/commons \
    packages/models \
    packages/signed-objects-persister/dist && \
    find /out -exec touch -h --date=@0 {} \;  

FROM ${NODE_REGISTRY}/node:20.19.4-slim@sha256:ef358d9fa0734e2c3b42482aa352c28a59245bc3d32e07ef57810cf8ba9092c5 AS final

COPY --from=build /out /app

WORKDIR /app/packages/signed-objects-persister
EXPOSE 3000

CMD ["node", "."]
