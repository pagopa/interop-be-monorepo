import {
  genericLogger,
  initFileManager,
  initRedisRateLimiter,
  rateLimiterHeadersFromStatus,
} from "pagopa-interop-commons";
import { fastifyFormbody } from "@fastify/formbody";
import Fastify, { FastifyRequest } from "fastify";
import { FastifyInstance } from "fastify";
import { generateId, tooManyRequestsError } from "pagopa-interop-models";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { KMSClient } from "@aws-sdk/client-kms";
import { initProducer } from "kafka-iam-auth";
import { makeApiProblem } from ".././model/domain/errors.js";
import { authorizationServerErrorMapper } from ".././utilities/errorMappers.js";
import { tokenServiceBuilder } from ".././services/tokenService.js";
import { config } from ".././config/config.js";

// const serviceName = "authorization-server";

const dynamoDBClient = new DynamoDBClient({});
const kmsClient = new KMSClient({});
const redisRateLimiter = await initRedisRateLimiter({
  // TODO add limiter group
  limiterGroup: "TODO",
  maxRequests: config.rateLimiterMaxRequests,
  rateInterval: config.rateLimiterRateInterval,
  burstPercentage: config.rateLimiterBurstPercentage,
  redisHost: config.rateLimiterRedisHost,
  redisPort: config.rateLimiterRedisPort,
  timeout: config.rateLimiterTimeout,
});
const producer = await initProducer(config, config.tokenAuditingTopic);
const fileManager = initFileManager(config);
// TODO: logger in middleware?
const logger = genericLogger;

// TODO Enable logging once error handling is completed
// const server: FastifyInstance = Fastify({ logger: { level: 'error' } })
const fastifyServer: FastifyInstance = Fastify();
await fastifyServer.register(fastifyFormbody);
const correlationId = generateId();

// TODO: temporary export for tests
export const tokenService = tokenServiceBuilder({
  dynamoDBClient,
  kmsClient,
  redisRateLimiter,
  producer,
  correlationId,
  fileManager,
  logger,
});

// TODO: add middlewares with @fastify/express?

fastifyServer.post(
  "/token.oauth2",
  async (
    request: FastifyRequest<{
      Body: authorizationServerApi.AccessTokenRequest;
    }>,
    reply
  ) => {
    try {
      const res = await tokenService.generateToken(request.body);

      if (res.limitReached) {
        const headers = rateLimiterHeadersFromStatus(res.rateLimiterStatus);
        const errorRes = makeApiProblem(
          tooManyRequestsError(res.rateLimitedTenantId),
          authorizationServerErrorMapper,
          logger
        );

        return reply.status(errorRes.status).headers(headers).send(errorRes);
      }

      return reply.status(200).send({
        access_token: res.token.serialized,
        token_type: "Bearer",
        expires_in: res.token.payload.exp,
      });
    } catch (err) {
      // TODO correlationId? It's supposed to be in the ApiError object, but it's never done in the project
      const errorRes = makeApiProblem(
        err,
        authorizationServerErrorMapper,
        logger
      );
      return reply.status(errorRes.status).send(errorRes);
    }
  }
);

fastifyServer.get("/health", async (_, reply) => reply.status(204));

export default fastifyServer;
