import { genericLogger, initRedisRateLimiter } from "pagopa-interop-commons";
import { fastifyFormbody } from "@fastify/formbody";
import Fastify from "fastify";
import { FastifyInstance } from "fastify";
import { generateId, genericInternalError } from "pagopa-interop-models";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { KMSClient } from "@aws-sdk/client-kms";
import { makeApiProblem } from "./model/domain/errors.js";
import { sampleErrorMapper } from "./utilities/errorMappers.js";
import { tokenServiceBuilder } from "./services/tokenService.js";

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

// TODO Enable logging once error handling is completed
// const server: FastifyInstance = Fastify({ logger: { level: 'error' } })
export const fastifyServer: FastifyInstance = Fastify();
await fastifyServer.register(fastifyFormbody);

const tokenService = tokenServiceBuilder(
  dynamoDBClient,
  kmsClient,
  redisRateLimiter
);

fastifyServer.post("/token.oauth2", async (request, reply) => {
  const correlationId = generateId();
  const tokenRequest = authorizationServerApi.AccessTokenRequest.safeParse(
    request.body
  );
  if (tokenRequest.success) {
    try {
      const res = await tokenService.generateToken(tokenRequest.data);
      return reply.status(200).send({
        res, // TODO check type for response
      });
    } catch (err) {
      // TODO correlationId
      const errorRes = makeApiProblem(err, sampleErrorMapper, genericLogger);
      return reply.status(errorRes.status).send(errorRes);
    }
  } else {
    // console.log(tokenRequest.error.format());
    return reply
      .status(400)
      .send({ correlationId, ...genericInternalError("") });
  }
});

fastifyServer.get("/health", async (_, reply) => reply.status(204));
