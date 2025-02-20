import { constants } from "http2";
import {
  fromAppContext,
  initFileManager,
  initMemoryRateLimiter,
  InteropTokenGenerator,
  rateLimiterHeadersFromStatus,
  zodiosCtx,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { Problem, tooManyRequestsError } from "pagopa-interop-models";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { initProducer } from "kafka-iam-auth";
import express from "express";
import { makeApiProblem } from "../model/domain/errors.js";
import { authorizationServerErrorMapper } from "../utilities/errorMappers.js";
import { tokenServiceBuilder } from "../services/tokenService.js";
import { config } from "../config/config.js";

const dynamoDBClient = new DynamoDBClient();
const rateLimiter = await initMemoryRateLimiter({
  limiterGroup: "AUTHSERVER",
  maxRequests: config.rateLimiterMaxRequests,
  rateInterval: config.rateLimiterRateInterval,
  burstPercentage: config.rateLimiterBurstPercentage,
});
const producer = await initProducer(config, config.tokenAuditingTopic);
const fileManager = initFileManager(config);

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
  rateLimiter,
  producer,
  fileManager,
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function authorizationServerRouter(): express.Router {
  const authorizationServerRouter = zodiosCtx.router(
    authorizationServerApi.authApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );
  authorizationServerRouter.post(
    "/authorization-server/token.oauth2",
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const tokenResult = await tokenService.generateToken(
          req.body,
          ctx.correlationId,
          ctx.logger
        );

        const headers = rateLimiterHeadersFromStatus(
          tokenResult.rateLimiterStatus
        );
        res.set(headers);

        if (tokenResult.limitReached) {
          const errorRes = makeApiProblem(
            tooManyRequestsError(tokenResult.rateLimitedTenantId),
            authorizationServerErrorMapper,
            ctx.logger,
            ctx.correlationId
          );

          return res.status(errorRes.status).send(errorRes);
        }

        return res.status(200).send({
          access_token: tokenResult.token.serialized,
          token_type: "Bearer",
          expires_in: tokenResult.token.payload.exp,
        });
      } catch (err) {
        const errorRes = makeApiProblem(
          err,
          authorizationServerErrorMapper,
          ctx.logger,
          ctx.correlationId
        );
        if (errorRes.status === constants.HTTP_STATUS_BAD_REQUEST) {
          const cleanedError: Problem = {
            title: "The request contains bad syntax or cannot be fulfilled.",
            type: "about:blank",
            status: constants.HTTP_STATUS_BAD_REQUEST,
            detail: "Bad request",
            errors: [
              {
                code: "015-0008",
                detail: "Unable to generate a token for the given request",
              },
            ],
            correlationId: ctx.correlationId,
          };

          return res.status(cleanedError.status).send(cleanedError);
        } else {
          const cleanedError: Problem = {
            title: "The request couldn't be fulfilled due to an internal error",
            type: "internalServerError",
            status: constants.HTTP_STATUS_INTERNAL_SERVER_ERROR,
            detail: "Internal server error",
            errors: [
              {
                code: "015-0000",
                detail:
                  "Unable to generate a token for the given request due to an internal error",
              },
            ],
            correlationId: ctx.correlationId,
          };
          return res.status(cleanedError.status).send(cleanedError);
        }
      }
    }
  );

  // This cast will be removed when the router and the entire service
  // will drop fastify-express and will be fully migrated to fastify
  return authorizationServerRouter as unknown as express.Router;
}

export default authorizationServerRouter;
