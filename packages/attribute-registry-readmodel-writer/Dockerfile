FROM node:18.17.1-slim as build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/

COPY ./packages/attribute-registry-readmodel-writer/package.json /app/packages/attribute-registry-readmodel-writer/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/attribute-registry-readmodel-writer /app/packages/attribute-registry-readmodel-writer
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models

RUN pnpm build

WORKDIR /app/packages/attribute-registry-readmodel-writer
EXPOSE 3000

CMD ["node", "."]