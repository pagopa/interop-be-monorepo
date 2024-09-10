FROM node:18-alpine AS base

FROM base AS builder
RUN apk add --no-cache libc6-compat
RUN apk update

# Set working directory
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo prune --scope=one-trust-notices --docker

# remove all empty node_modules folder structure
RUN rm -rf /app/out/full/*/*/node_modules

# Add lockfile and package.json's of isolated subworkspace
FROM base AS installer
RUN apk add --no-cache libc6-compat
RUN apk update
WORKDIR /app

# First install the dependencies (as they change less often)
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN corepack enable

# Build the project
COPY --from=builder /app/out/full/ .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=one-trust-notices

CMD node ./jobs/one-trust-notices/dist
