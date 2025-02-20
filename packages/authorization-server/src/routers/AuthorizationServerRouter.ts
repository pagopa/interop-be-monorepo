import { constants } from "http2";
import {
  AppContext,
  fromAppContext,
  initFileManager,
  InteropTokenGenerator,
  rateLimiterHeadersFromStatus,
} from "pagopa-interop-commons";
import express from "express";
import { Problem, tooManyRequestsError } from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { initProducer } from "kafka-iam-auth";
import { makeApiProblem } from "../model/domain/errors.js";
import { authorizationServerErrorMapper } from "../utilities/errorMappers.js";
import { tokenServiceBuilder } from "../services/tokenService.js";
import { config } from "../config/config.js";

const dynamoDBClient = new DynamoDBClient();
/* TODO rate limiter removed for performance tests.
  Re-enable it when performance tests are completed, if
  rate limiter is not the bottleneck.
  Otherwise we should consider a different approach.
*/
// const redisRateLimiter = await initRedisRateLimiter({
//   limiterGroup: "AUTHSERVER",
//   maxRequests: config.rateLimiterMaxRequests,
//   rateInterval: config.rateLimiterRateInterval,
//   burstPercentage: config.rateLimiterBurstPercentage,
//   redisHost: config.rateLimiterRedisHost,
//   redisPort: config.rateLimiterRedisPort,
//   timeout: config.rateLimiterTimeout,
// });

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
  // redisRateLimiter,
  producer,
  fileManager,
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function authorizationServerRouter(): express.Router {
  // TODO using express.Router() instead of zodiosCtx.router() for performance tests.
  // const authorizationServerRouter = zodiosCtx.router(
  //   authorizationServerApi.authApi.api,
  //   {
  //     validationErrorHandler: zodiosValidationErrorToApiProblem,
  //   }
  // );
  const authorizationServerRouter = express.Router();
  authorizationServerRouter.post(
    "/authorization-server/token.oauth2",
    async (
      req: express.Request & {
        ctx?: AppContext;
      },
      res
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const ctx = fromAppContext(req.ctx!);

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
  return authorizationServerRouter;
}

export default authorizationServerRouter;
