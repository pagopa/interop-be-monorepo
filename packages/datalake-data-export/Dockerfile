#default value for compatibility
ARG NODE_REGISTRY="docker.io"

FROM ${NODE_REGISTRY}/node:20.19.4-slim@sha256:6db5e436948af8f0244488a1f658c2c8e55a3ae51ca2e1686ed042be8f25f70a AS build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/
COPY .npmrc /app/

COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/datalake-data-export/package.json /app/packages/datalake-data-export/package.json
COPY ./packages/readmodel/package.json /app/packages/readmodel/package.json
COPY ./packages/readmodel-models/package.json /app/packages/readmodel-models/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/

COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/datalake-data-export /app/packages/datalake-data-export
COPY ./packages/readmodel /app/packages/readmodel
COPY ./packages/readmodel-models /app/packages/readmodel-models

RUN pnpm build && \
  rm -rf /app/node_modules/.modules.yaml && \
  rm -rf /app/node_modules/.cache && \
  mkdir /out && \
  cp -a --parents -t /out \
  node_modules packages/datalake-data-export/node_modules \
  package*.json packages/datalake-data-export/package*.json \
  packages/commons/ \
  packages/models/ \
  packages/readmodel/ \
  packages/readmodel-models/ \
  packages/datalake-data-export/dist && \
  find /out -exec touch -h --date=@0 {} \;

FROM ${NODE_REGISTRY}/node:20.19.4-slim@sha256:6db5e436948af8f0244488a1f658c2c8e55a3ae51ca2e1686ed042be8f25f70a AS final

COPY --from=build /out /app

RUN groupadd -r app && useradd -rm -g app app
RUN chown -R app:app /app && chmod -R 700 /app
USER app

WORKDIR /app/packages/datalake-data-export

CMD [ "node", "." ]
