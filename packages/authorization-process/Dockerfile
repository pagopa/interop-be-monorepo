FROM node:18.20.3-slim@sha256:408f8cbbb7b33a5bb94bdb8862795a94d2b64c2d516856824fd86c4a5594a443 as build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/

COPY ./packages/authorization-process/package.json /app/packages/authorization-process/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/authorization-process /app/packages/authorization-process
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models

RUN pnpm build && \
    rm -rf /app/node_modules/.modules.yaml && \
    rm -rf /app/node_modules/.cache && \
    mkdir /out && \
    cp -a --parents -t /out \
      node_modules packages/authorization-process/node_modules \
      package*.json packages/authorization-process/package*.json \
      packages/commons/ \
      packages/models/ \
      packages/authorization-process/dist && \
    find /out -exec touch -h --date=@0 {} \;

FROM node:18.20.3-slim@sha256:408f8cbbb7b33a5bb94bdb8862795a94d2b64c2d516856824fd86c4a5594a443 as final 

COPY --from=build /out /app

WORKDIR /app/packages/authorization-process
EXPOSE 3000

CMD [ "node", "." ]
