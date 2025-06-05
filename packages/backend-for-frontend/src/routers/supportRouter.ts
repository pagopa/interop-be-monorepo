import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import {
  ApiError,
  emptyErrorMapper,
  genericError,
} from "pagopa-interop-models";
import { AuthorizationService } from "../services/authorizationService.js";
import { makeApiProblem } from "../model/errors.js";
import { fromBffAppContext } from "../utilities/context.js";

const supportRouter = (
  ctx: ZodiosContext,
  authorizationService: AuthorizationService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const supportRouter = ctx.router(bffApi.supportApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  supportRouter.post("/session/saml2/tokens", async (req, res) => {
    const ctx = fromBffAppContext(req.ctx, req.headers);

    try {
      const sessionToken = await authorizationService.getSaml2Token(
        req.body,
        ctx
      );
      return res.status(200).send(bffApi.SessionToken.parse(sessionToken));
    } catch (error) {
      ctx.logger.info(
        `Error creating a session token: ${
          error instanceof ApiError ? error.detail : error
        }. Returning a generic error response.`
      );
      const errorRes = makeApiProblem(
        genericError("Error creating a session token"),
        emptyErrorMapper,
        ctx,
        "Error creating a session token"
      );
      return res.status(errorRes.status).send(errorRes);
    }
  });

  return supportRouter;
};

export default supportRouter;
