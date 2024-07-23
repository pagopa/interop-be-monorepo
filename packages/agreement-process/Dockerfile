FROM node:20.14.0@sha256:02cd2205818f121c13612721876f28c18bd50148bb8af532ea121c96ffcb59bf as build

RUN corepack enable

WORKDIR /app
COPY package.json /app/
COPY pnpm-lock.yaml /app/
COPY pnpm-workspace.yaml /app/

COPY ./packages/agreement-process/package.json /app/packages/agreement-process/package.json
COPY ./packages/commons/package.json /app/packages/commons/package.json
COPY ./packages/models/package.json /app/packages/models/package.json
COPY ./packages/agreement-lifecycle/package.json /app/packages/agreement-lifecycle/package.json
COPY ./packages/api-clients/package.json /app/packages/api-clients/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY tsconfig.json /app/
COPY turbo.json /app/
COPY ./packages/agreement-process /app/packages/agreement-process
COPY ./packages/commons /app/packages/commons
COPY ./packages/models /app/packages/models
COPY ./packages/agreement-lifecycle /app/packages/agreement-lifecycle
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
      packages/agreement-lifecycle/ \
      packages/api-clients \
      packages/agreement-process/dist && \
    find /out -exec touch -h --date=@0 {} \;

FROM node:20.14.0@sha256:02cd2205818f121c13612721876f28c18bd50148bb8af532ea121c96ffcb59bf as final 

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
EXPOSE 3100

CMD [ "node", "." ]
