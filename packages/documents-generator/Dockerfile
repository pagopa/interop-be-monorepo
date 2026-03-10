#default value for compatibility
ARG NODE_REGISTRY="docker.io"

FROM ${NODE_REGISTRY}/node:20.19.3-slim@sha256:fa43945ad45c5f8c50dbea0633d888ddeb739f7d4e06c7696a9d68b54054238a AS build 

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/
COPY .npmrc /app/

COPY ./packages/documents-generator/package.json /app/packages/documents-generator/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/agreement-lifecycle/package.json /app/packages/agreement-lifecycle/package.json
COPY ./packages/readmodel/package.json /app/packages/readmodel/package.json
COPY ./packages/readmodel-models/package.json /app/packages/readmodel-models/package.json
COPY ./packages/kafka-iam-auth/package.json /app/packages/kafka-iam-auth/package.json
COPY ./packages/api-clients/package.json /app/packages/api-clients/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/

COPY ./packages/documents-generator /app/packages/documents-generator
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/agreement-lifecycle /app/packages/agreement-lifecycle
COPY ./packages/readmodel /app/packages/readmodel
COPY ./packages/readmodel-models /app/packages/readmodel-models
COPY ./packages/kafka-iam-auth /app/packages/kafka-iam-auth
COPY ./packages/api-clients /app/packages/api-clients

RUN pnpm build && \
    rm -rf /app/node_modules/.modules.yaml && \
    rm -rf /app/node_modules/.cache && \
    mkdir /out && \
    cp -a --parents -t /out \
    node_modules packages/documents-generator/node_modules \
    package*.json packages/documents-generator/package*.json \
    packages/commons \
    packages/models \
    packages/agreement-lifecycle/ \
    packages/readmodel/ \
    packages/readmodel-models/ \
    packages/kafka-iam-auth \
    packages/api-clients \
    packages/documents-generator/dist && \
    find /out -exec touch -h --date=@0 {} \;  

FROM ${NODE_REGISTRY}/node:20.19.3-slim@sha256:fa43945ad45c5f8c50dbea0633d888ddeb739f7d4e06c7696a9d68b54054238a AS final

# Install dependencies for Puppeteer
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates 

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY --from=build /out /app

RUN groupadd -r app && useradd -rm -g app -G audio,video app
RUN chown -R app:app /app && chmod -R 700 /app
USER app

WORKDIR /app/packages/documents-generator
EXPOSE 3000

CMD ["node", "."]