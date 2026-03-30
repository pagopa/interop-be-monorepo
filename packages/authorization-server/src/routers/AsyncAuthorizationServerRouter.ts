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
  handleAsyncTokenError,
  handleRateLimitResponse,
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

      // This should not be reached until individual scope handlers are implemented.
      // Each scope handler will return the appropriate response.
      return res.status(501).send();
    } catch (err) {
      const problem = handleAsyncTokenError(err, getCtx());
      return res.status(problem.status).send(problem);
    }
  });

  return router;
};

export default asyncAuthorizationServerRouter;
