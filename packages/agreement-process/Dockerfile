FROM node:20.14.0@sha256:d0a9a2399581a9de1ff962a48a28b5cfe700678a6a5df8e31a63aaa47bebb923 as build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/

COPY ./packages/agreement-process/package.json /app/packages/agreement-process/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/selfcare-v2-client/package.json /app/packages/selfcare-v2-client/package.json
COPY ./packages/api-clients/package.json /app/packages/api-clients/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/agreement-process /app/packages/agreement-process
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/selfcare-v2-client /app/packages/selfcare-v2-client
COPY ./packages/api-clients /app/packages/api-clients

RUN pnpm build && \
    rm -rf /app/node_modules/.modules.yaml && \
    rm -rf /app/node_modules/.cache && \
    mkdir /out && \
    cp -a --parents -t /out \
      node_modules packages/agreement-process/node_modules \
      package*.json packages/agreement-process/package*.json \
      packages/commons/ \
      packages/models/ \
      packages/selfcare-v2-client \
      packages/api-clients \
      packages/agreement-process/dist && \
    find /out -exec touch -h --date=@0 {} \;

FROM node:20.14.0@sha256:d0a9a2399581a9de1ff962a48a28b5cfe700678a6a5df8e31a63aaa47bebb923 as final 

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

WORKDIR /app/packages/agreement-process
EXPOSE 3000

CMD [ "node", "." ]
