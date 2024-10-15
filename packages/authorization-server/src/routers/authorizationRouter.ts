import {
  genericLogger,
  initFileManager,
  initRedisRateLimiter,
} from "pagopa-interop-commons";
import { fastifyFormbody } from "@fastify/formbody";
import Fastify, { FastifyRequest } from "fastify";
import { FastifyInstance } from "fastify";
import { generateId } from "pagopa-interop-models";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { KMSClient } from "@aws-sdk/client-kms";
import { initProducer } from "kafka-iam-auth";
import { makeApiProblem } from ".././model/domain/errors.js";
import { sampleErrorMapper } from ".././utilities/errorMappers.js";
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

// TODO Enable logging once error handling is completed
// const server: FastifyInstance = Fastify({ logger: { level: 'error' } })
const fastifyServer: FastifyInstance = Fastify();
await fastifyServer.register(fastifyFormbody);

const tokenService = tokenServiceBuilder({
  dynamoDBClient,
  kmsClient,
  redisRateLimiter,
  producer,
  correlationId: generateId(),
  fileManager,
  logger: genericLogger,
});

fastifyServer.post(
  "/token.oauth2",
  async (
    request: FastifyRequest<{
      Body: authorizationServerApi.AccessTokenRequest;
    }>,
    reply
  ) => {
    // const correlationId = generateId();

    try {
      const res = await tokenService.generateToken(request.body);
      return reply.status(200).send({
        res, // TODO check type for response
      });
    } catch (err) {
      // TODO correlationId
      const errorRes = makeApiProblem(err, sampleErrorMapper, genericLogger);
      return reply.status(errorRes.status).send(errorRes);
    }
  }
);

fastifyServer.get("/health", async (_, reply) => reply.status(204));

export default fastifyServer;
