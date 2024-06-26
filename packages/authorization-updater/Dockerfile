FROM node:20.14.0-slim@sha256:0ff3b9e24e805e08f2e4f822957d1deee86bb07927c70ba8440de79a6a885da6 as build 

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/

COPY ./packages/authorization-updater/package.json /app/packages/authorization-updater/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/kafka-iam-auth/package.json /app/packages/kafka-iam-auth/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/

COPY ./packages/authorization-updater /app/packages/authorization-updater
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/kafka-iam-auth /app/packages/kafka-iam-auth

RUN pnpm build && \
  rm -rf /app/node_modules/.modules.yaml && \
  rm -rf /app/node_modules/.cache && \
  mkdir /out && \
  cp -a --parents -t /out \
    node_modules packages/authorization-updater/node_modules \
    package*.json packages/authorization-updater/package*.json \
    packages/commons \
    packages/models \
    packages/kafka-iam-auth \
    packages/authorization-updater/dist && \
  find /out -exec touch -h --date=@0 {} \;  

FROM node:20.14.0-slim@sha256:0ff3b9e24e805e08f2e4f822957d1deee86bb07927c70ba8440de79a6a885da6 as final 

COPY --from=build /out /app

WORKDIR /app/packages/authorization-updater
EXPOSE 3000

CMD ["node", "."]