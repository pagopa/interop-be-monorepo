import {
  ExpressContext,
  rateLimiterHeadersFromStatus,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { AsyncTokenService } from "../services/asyncTokenService.js";
import {
  buildCtxHelpers,
  handleRateLimitResponse,
  handleTokenError,
} from "../utilities/routerUtils.js";

const asyncAuthorizationServerRouter = (
  ctx: ZodiosContext,
  asyncTokenService: AsyncTokenService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const router = ctx.router(authorizationServerApi.asyncAuthApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  router.post("/token.oauth2.async", async (req, res) => {
    const { getCtx, setCtxClientId, setCtxClientKind, setCtxOrganizationId } =
      buildCtxHelpers(req.ctx);

    try {
      const result = await asyncTokenService.generateAsyncToken(
        req.headers,
        req.body,
        getCtx,
        setCtxClientId,
        setCtxClientKind,
        setCtxOrganizationId
      );

      const headers = rateLimiterHeadersFromStatus(result.rateLimiterStatus);
      res.set(headers);

      if (result.limitReached) {
        return handleRateLimitResponse(
          res,
          result.rateLimitedTenantId,
          getCtx()
        );
      }

      if (result.tokenGenerated) {
        return res.status(200).send({
          access_token: result.token.serialized,
          token_type: result.isDPoP ? "DPoP" : "Bearer",
          expires_in: result.token.payload.exp - result.token.payload.iat,
        });
      }

      // Fallthrough for unimplemented scopes
      return res.status(501).send();
    } catch (err) {
      const { status, body } = handleTokenError(err, getCtx());
      return res.status(status).send(body);
    }
  });

  return router;
};

export default asyncAuthorizationServerRouter;
