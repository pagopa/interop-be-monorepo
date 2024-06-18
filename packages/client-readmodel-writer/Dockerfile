FROM node:18.20.2-slim@sha256:2697eb70c760c3720ad9811871d5ab19c4ad2f2e0a3735785e531927ab99bd39 as build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/

COPY ./packages/client-readmodel-writer/package.json /app/packages/client-readmodel-writer/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/kafka-iam-auth/package.json /app/packages/kafka-iam-auth/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/client-readmodel-writer /app/packages/client-readmodel-writer
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/kafka-iam-auth /app/packages/kafka-iam-auth

RUN pnpm build && \
    rm -rf /app/node_modules/.modules.yaml && \
    rm -rf /app/node_modules/.cache && \
    mkdir /out && \
    cp -a --parents -t /out \
      node_modules packages/client-readmodel-writer/node_modules \
      package*.json packages/client-readmodel-writer/package*.json \
      packages/commons \
      packages/models \
      packages/kafka-iam-auth \
      packages/client-readmodel-writer/dist && \
    find /out -exec touch -h --date=@0 {} \;

FROM node:18.20.2-slim@sha256:2697eb70c760c3720ad9811871d5ab19c4ad2f2e0a3735785e531927ab99bd39 as final 

COPY --from=build /out /app

WORKDIR /app/packages/client-readmodel-writer
EXPOSE 3000

CMD ["node", "."]
