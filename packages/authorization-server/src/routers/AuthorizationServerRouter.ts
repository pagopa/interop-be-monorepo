import { constants } from "http2";
import {
  AuthServerAppContext,
  ExpressContext,
  logger,
  rateLimiterHeadersFromStatus,
  WithLogger,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import {
  ClientId,
  ClientKindTokenGenStates,
  Problem,
  TenantId,
  tooManyRequestsError,
} from "pagopa-interop-models";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { makeApiProblem } from "../model/domain/errors.js";
import { authorizationServerErrorMapper } from "../utilities/errorMappers.js";
import { TokenService } from "../services/tokenService.js";

const authorizationServerRouter = (
  ctx: ZodiosContext,
  tokenService: TokenService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const authorizationServerRouter = ctx.router(
    authorizationServerApi.authApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );
  authorizationServerRouter.post("/token.oauth2", async (req, res) => {
    /* generateToken needs to mutate the context to set the clientId and organizationId,
      so that they can be used in further middlewares (e.g., the application audit).
      We create two dedicated mutation functions so that we can pass down a read-only context
      and the mutation function, and avoid mutating it directly.
      */
    const setCtxClientId = (clientId: ClientId): void => {
      // eslint-disable-next-line functional/immutable-data
      req.ctx.clientId = clientId;
    };

    const setCtxOrganizationId = (organizationId: TenantId): void => {
      // eslint-disable-next-line functional/immutable-data
      req.ctx.organizationId = organizationId;
    };

    const setCtxClientKind = (
      tokenGenClientKind: ClientKindTokenGenStates
    ): void => {
      // eslint-disable-next-line functional/immutable-data
      req.ctx.clientKind = tokenGenClientKind;
    };

    const getCtx = (): WithLogger<AuthServerAppContext> => ({
      ...req.ctx,
      logger: logger({ ...req.ctx }),
    });

    try {
      const tokenResult = await tokenService.generateToken(
        req.headers,
        req.body,
        getCtx,
        setCtxClientId,
        setCtxClientKind,
        setCtxOrganizationId
      );

      const headers = rateLimiterHeadersFromStatus(
        tokenResult.rateLimiterStatus
      );
      res.set(headers);

      if (tokenResult.limitReached) {
        const errorRes = makeApiProblem(
          tooManyRequestsError(tokenResult.rateLimitedTenantId),
          authorizationServerErrorMapper,
          getCtx()
        );

        return res.status(errorRes.status).send(errorRes);
      }

      return res.status(200).send({
        access_token: tokenResult.token.serialized,
        token_type: tokenResult.isDPoP ? "DPoP" : "Bearer",
        expires_in:
          tokenResult.token.payload.exp - tokenResult.token.payload.iat,
      });
    } catch (err) {
      const errorRes = makeApiProblem(
        err,
        authorizationServerErrorMapper,
        getCtx()
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
          correlationId: req.ctx.correlationId,
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
          correlationId: req.ctx.correlationId,
        };
        return res.status(cleanedError.status).send(cleanedError);
      }
    }
  });
  return authorizationServerRouter;
};

export default authorizationServerRouter;
