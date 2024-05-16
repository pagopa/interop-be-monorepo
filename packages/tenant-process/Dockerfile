FROM node:18.20.2-slim@sha256:2697eb70c760c3720ad9811871d5ab19c4ad2f2e0a3735785e531927ab99bd39 as build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/

COPY ./packages/tenant-process/package.json /app/packages/tenant-process/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/tenant-process /app/packages/tenant-process
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models

RUN pnpm build && \
    rm -rf /app/node_modules/.modules.yaml && \
    rm -rf /app/node_modules/.cache && \
    mkdir /out && \
    cp -a --parents -t /out \
      node_modules packages/tenant-process/node_modules \
      package*.json packages/tenant-process/package*.json \
      packages/commons \
      packages/models \
      packages/tenant-process/dist && \
    find /out -exec touch -h --date=@0 {} \;

FROM node:18.20.2-slim@sha256:2697eb70c760c3720ad9811871d5ab19c4ad2f2e0a3735785e531927ab99bd39 as final 

COPY --from=build /out /app

WORKDIR /app/packages/tenant-process
EXPOSE 3000

CMD [ "node", "." ]
