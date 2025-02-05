FROM node:20.14.0@sha256:02cd2205818f121c13612721876f28c18bd50148bb8af532ea121c96ffcb59bf as build

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/
COPY .npmrc /app/

COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/datalake-data-export/package.json /app/packages/datalake-data-export/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/

COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/datalake-data-export /app/packages/datalake-data-export

RUN pnpm build && \
  rm -rf /app/node_modules/.modules.yaml && \
  rm -rf /app/node_modules/.cache && \
  mkdir /out && \
  cp -a --parents -t /out \
  node_modules packages/datalake-data-export/node_modules \
  package*.json packages/datalake-data-export/package*.json \
  packages/commons/ \
  packages/models/ \
  packages/datalake-data-export/dist && \
  find /out -exec touch -h --date=@0 {} \;

FROM node:20.14.0-slim@sha256:5e8ac65a0231d76a388683d07ca36a9769ab019a85d85169fe28e206f7a3208e as final 

COPY --from=build /out /app

WORKDIR /app/packages/datalake-data-export

CMD [ "node", "." ]
