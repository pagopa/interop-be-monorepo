FROM node:18.17.1-slim as build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/

COPY ./packages/catalog-readmodel-writer/package.json /app/packages/catalog-readmodel-writer/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/kafka-iam-auth/package.json /app/packages/kafka-iam-auth/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/catalog-readmodel-writer /app/packages/catalog-readmodel-writer
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/kafka-iam-auth /app/packages/kafka-iam-auth

RUN pnpm build && \
    rm -rf /app/node_modules/.modules.yaml && \
    rm -rf /app/node_modules/.cache && \
    mkdir /out && \
    cp -a --parents -t /out \
      node_modules packages/catalog-readmodel-writer/node_modules \
      package*.json packages/catalog-readmodel-writer/package*.json \
      packages/catalog-readmodel-writer/dist && \
    find /out -exec touch -h --date=@0 {} \;

FROM node:18.17.1-slim as final 

COPY --from=build /out /app

WORKDIR /app/packages/catalog-readmodel-writer
EXPOSE 3000

CMD ["node", "."]
