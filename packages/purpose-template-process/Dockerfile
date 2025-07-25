#default value for compatibility
ARG NODE_REGISTRY="docker.io"

FROM ${NODE_REGISTRY}/node:20.19.3-slim@sha256:f8f6771d949ff351c061de64ef9cbfbc5949015883fb3b016b34aca6d0e5b8cc AS build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/
COPY .npmrc /app/

COPY ./packages/purpose-template-process/package.json /app/packages/purpose-template-process/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json

# Install dependencies for Puppeteer
RUN apt-get update && \
  apt-get install -y --no-install-recommends \
  chromium \
  ca-certificates 

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN groupadd -r app && useradd -rm -g app -G audio,video app

COPY --from=build /out /app

RUN chown -R app:app /app
RUN chmod -R 700 /app
USER app

WORKDIR /app/packages/purpose-process
EXPOSE 4300

CMD [ "node", "." ]
