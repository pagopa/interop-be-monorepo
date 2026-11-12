#default value for compatibility
ARG NODE_REGISTRY="docker.io"

FROM ${NODE_REGISTRY}/node:24.22.1-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c AS build 

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/
COPY .npmrc /app/

COPY ./packages/domains-analytics-writer/package.json /app/packages/domains-analytics-writer/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/readmodel/package.json /app/packages/readmodel/package.json
COPY ./packages/readmodel-models/package.json /app/packages/readmodel-models/package.json
COPY ./packages/kafka-iam-auth/package.json /app/packages/kafka-iam-auth/package.json
COPY ./packages/kpi-models/package.json /app/packages/kpi-models/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/

COPY ./packages/domains-analytics-writer /app/packages/domains-analytics-writer
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/readmodel /app/packages/readmodel
COPY ./packages/readmodel-models /app/packages/readmodel-models
COPY ./packages/kafka-iam-auth /app/packages/kafka-iam-auth
COPY ./packages/kpi-models /app/packages/kpi-models

ARG NODE_HEAP_SIZE=4096
RUN NODE_OPTIONS="--max-old-space-size=${NODE_HEAP_SIZE}" pnpm build && \
  rm -rf /app/node_modules/.modules.yaml && \
  rm -rf /app/node_modules/.cache && \
  mkdir /out && \
  cp -a --parents -t /out \
  node_modules packages/domains-analytics-writer/node_modules \
  package*.json packages/domains-analytics-writer/package*.json \
  packages/commons \
  packages/models \
  packages/readmodel \
  packages/readmodel-models \
  packages/kafka-iam-auth \
  packages/kpi-models \
  packages/domains-analytics-writer/dist && \
  find /out -exec touch -h --date=@0 {} \;  

FROM ${NODE_REGISTRY}/node:24.22.1-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c AS final

COPY --from=build /out /app

RUN groupadd -r app && useradd -rm -g app app
RUN chown -R app:app /app && chmod -R 700 /app
USER app

WORKDIR /app/packages/domains-analytics-writer
EXPOSE 3000

CMD ["node", "."]
