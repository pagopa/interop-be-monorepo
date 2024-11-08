import {
  initFileManager,
  initRedisRateLimiter,
  InteropTokenGenerator,
  logger,
  LoggerMetadata,
  rateLimiterHeadersFromStatus,
} from "pagopa-interop-commons";
import { fastifyFormbody } from "@fastify/formbody";
import Fastify, { FastifyRequest } from "fastify";
import { FastifyInstance } from "fastify";
import {
  CorrelationId,
  generateId,
  tooManyRequestsError,
} from "pagopa-interop-models";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { initProducer } from "kafka-iam-auth";
import { makeApiProblem } from "../model/domain/errors.js";
import { authorizationServerErrorMapper } from "../utilities/errorMappers.js";
import { tokenServiceBuilder } from "../services/tokenService.js";
import { config } from "../config/config.js";
import { InteropTokenResponse } from "../model/domain/models.js";

const serviceName = "authorization-server";

const dynamoDBClient = new DynamoDBClient({});
const redisRateLimiter = await initRedisRateLimiter({
  limiterGroup: "AUTHSERVER",
  maxRequests: config.rateLimiterMaxRequests,
  rateInterval: config.rateLimiterRateInterval,
  burstPercentage: config.rateLimiterBurstPercentage,
  redisHost: config.rateLimiterRedisHost,
  redisPort: config.rateLimiterRedisPort,
  timeout: config.rateLimiterTimeout,
});
const producer = await initProducer(config, config.tokenAuditingTopic);
const fileManager = initFileManager(config);

const fastifyServer: FastifyInstance = Fastify({ logger: { level: "error" } });
await fastifyServer.register(fastifyFormbody);

const tokenGenerator = new InteropTokenGenerator({
  generatedInteropTokenKid: config.generatedInteropTokenKid,
  generatedInteropTokenIssuer: config.generatedInteropTokenIssuer,
  generatedInteropTokenM2MAudience: config.generatedInteropTokenM2MAudience,
  generatedInteropTokenM2MDurationSeconds:
    config.generatedInteropTokenM2MDurationSeconds,
});

const tokenService = tokenServiceBuilder({
  tokenGenerator,
  dynamoDBClient,
  redisRateLimiter,
  producer,
  fileManager,
});

fastifyServer.post(
  "/token.oauth2",
  async (
    request: FastifyRequest<{
      Body: authorizationServerApi.AccessTokenRequest;
    }>,
    reply
  ) => {
    const correlationId = generateId<CorrelationId>();
    const loggerMetadata: LoggerMetadata = {
      serviceName,
      correlationId,
    };
    const loggerInstance = logger(loggerMetadata);

    try {
      const res = await tokenService.generateToken(
        request.body,
        correlationId,
        loggerInstance
      );

      const headers = rateLimiterHeadersFromStatus(res.rateLimiterStatus);
      await reply.headers(headers);

      if (res.limitReached) {
        const errorRes = makeApiProblem(
          tooManyRequestsError(res.rateLimitedTenantId),
          authorizationServerErrorMapper,
          loggerInstance,
          correlationId
        );

        return reply.status(errorRes.status).send(errorRes);
      }

      return reply.status(200).send({
        access_token: res.token.serialized,
        token_type: "Bearer",
        expires_in: res.token.payload.exp,
      } satisfies InteropTokenResponse);
    } catch (err) {
      const errorRes = makeApiProblem(
        err,
        authorizationServerErrorMapper,
        loggerInstance,
        correlationId
      );
      return reply.status(errorRes.status).send(errorRes);
    }
  }
);

fastifyServer.get("/status", async (_, reply) => reply.status(200).send());

export default fastifyServer;
