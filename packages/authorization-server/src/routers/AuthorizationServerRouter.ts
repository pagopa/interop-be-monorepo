import {
  ExpressContext,
  rateLimiterHeadersFromStatus,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { tooManyRequestsError } from "pagopa-interop-models";
import { authorizationServerApi } from "pagopa-interop-api-clients";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { makeApiProblem } from "../model/domain/errors.js";
import { authorizationServerErrorMapper } from "../utilities/errorMappers.js";
import { TokenService } from "../services/tokenService.js";
import { buildCtxHelpers, handleTokenError } from "../utilities/routerUtils.js";

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
    const { getCtx, setCtxClientId, setCtxClientKind, setCtxOrganizationId } =
      buildCtxHelpers(req.ctx);

    const ctx = getCtx();

    try {
      const tokenResult = await tokenService.generateToken(
        req.headers,
        req.body,
        ctx,
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
          ctx
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
      const { status, body } = handleTokenError(err, ctx);
      return res.status(status).send(body);
    }
  });
  return authorizationServerRouter;
};

export default authorizationServerRouter;
