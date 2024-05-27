FROM node:20.13.1-slim@sha256:cffed8cd39d6a380434e6d08116d188c53e70611175cd5ec7700f93f32a935a6 as build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/

COPY ./packages/purpose-process/package.json /app/packages/purpose-process/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/purpose-process /app/packages/purpose-process
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models

RUN pnpm build && \
    rm -rf /app/node_modules/.modules.yaml && \
    rm -rf /app/node_modules/.cache && \
    mkdir /out && \
    cp -a --parents -t /out \
      node_modules packages/purpose-process/node_modules \
      package*.json packages/purpose-process/package*.json \
      packages/commons/ \
      packages/models/ \
      packages/purpose-process/dist && \
    find /out -exec touch -h --date=@0 {} \;

FROM node:20.13.1-slim@sha256:cffed8cd39d6a380434e6d08116d188c53e70611175cd5ec7700f93f32a935a6 as final 

COPY --from=build /out /app

WORKDIR /app/packages/purpose-process
EXPOSE 3000

CMD [ "node", "." ]
