FROM node:20.14.0-slim@sha256:5e8ac65a0231d76a388683d07ca36a9769ab019a85d85169fe28e206f7a3208e as build

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/
COPY .npmrc /app/

COPY ./packages/authorization-server/package.json /app/packages/authorization-server/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/client-assertion-validation/package.json /app/packages/client-assertion-validation/package.json
COPY ./packages/kafka-iam-auth/package.json /app/packages/kafka-iam-auth/package.json
COPY ./packages/api-clients/package.json /app/packages/api-clients/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/authorization-server /app/packages/authorization-server
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/client-assertion-validation /app/packages/client-assertion-validation
COPY ./packages/kafka-iam-auth /app/packages/kafka-iam-auth
COPY ./packages/api-clients /app/packages/api-clients

RUN pnpm build && \
  rm -rf /app/node_modules/.modules.yaml && \
  rm -rf /app/node_modules/.cache && \
  mkdir /out && \
  cp -a --parents -t /out \
  node_modules packages/authorization-server/node_modules \
  package*.json packages/authorization-server/package*.json \
  packages/commons/ \
  packages/models/ \
  packages/client-assertion-validation/ \
  packages/kafka-iam-auth/ \
  packages/api-clients \
  packages/authorization-server/dist && \
  find /out -exec touch -h --date=@0 {} \;

FROM node:20.14.0-slim@sha256:5e8ac65a0231d76a388683d07ca36a9769ab019a85d85169fe28e206f7a3208e as final 

COPY --from=build /out /app

WORKDIR /app/packages/authorization-server
EXPOSE 3300

CMD [ "node", "." ]
