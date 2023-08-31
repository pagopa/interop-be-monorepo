FROM node:18-alpine as base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/
COPY tsconfig.json /app/
COPY turbo.json /app/

COPY ./packages/catalog-process /app/packages/catalog-process
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models

RUN pnpm i ts-node -w

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

RUN pnpm build

FROM base AS common
COPY --from=build /app/packages/commons/dist /app/packages/commons/dist
COPY --from=build /app/packages/models/dist /app/packages/models/dist


FROM common AS catalog-process
COPY --from=build /app/packages/catalog-process/dist /app/packages/catalog-process/dist

WORKDIR /app/packages/catalog-process
EXPOSE 3000

CMD [ "pnpm", "start" ]

