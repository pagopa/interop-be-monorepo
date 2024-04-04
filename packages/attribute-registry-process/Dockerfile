FROM node:18.17.1-slim as build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/

COPY ./packages/attribute-registry-process/package.json /app/packages/attribute-registry-process/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/attribute-registry-process /app/packages/attribute-registry-process
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models

RUN pnpm build && \
    rm -rf /app/node_modules/.modules.yaml && \
    rm -rf /app/node_modules/.cache && \
    mkdir /out && \
    cp -a --parents -t /out \
      node_modules packages/attribute-registry-process/node_modules \
      package*.json packages/attribute-registry-process/package*.json \
      packages/commons/ \
      packages/models/ \
      packages/attribute-registry-process/dist && \
    find /out -exec touch -h --date=@0 {} \;

FROM node:18.17.1-slim as final 

COPY --from=build /out /app

WORKDIR /app/packages/attribute-registry-process
EXPOSE 3000

CMD [ "node", "." ]
