import { constants } from "http2";
import {
  AuthServerAppContext,
  ExpressContext,
  logger,
  WithLogger,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import {
  ClientId,
  ClientKindTokenGenStates,
  Problem,
  TenantId,
} from "pagopa-interop-models";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { makeApiProblem } from "../model/domain/errors.js";
import { authorizationServerErrorMapper } from "../utilities/errorMappers.js";
import { AsyncTokenService } from "../services/asyncTokenService.js";

const asyncAuthorizationServerRouter = (
  ctx: ZodiosContext,
  asyncTokenService: AsyncTokenService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const router = ctx.router(authorizationServerApi.asyncAuthApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  router.post("/token.oauth2.async", async (req, res) => {
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
      await asyncTokenService.generateAsyncToken(
        req.headers,
        req.body,
        getCtx,
        setCtxClientId,
        setCtxClientKind,
        setCtxOrganizationId
      );

      // This should not be reached until individual scope handlers are implemented.
      // Each scope handler will return the appropriate response.
      return res.status(501).send();
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

  return router;
};

export default asyncAuthorizationServerRouter;
