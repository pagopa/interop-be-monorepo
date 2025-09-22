import { constants } from "http2";
import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { bffApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  isFeatureFlagEnabled,
  WithLogger,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import {
  emptyErrorMapper,
  featureFlagNotEnabled,
  Problem,
} from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { PurposeTemplateService } from "../services/purposeTemplateService.js";
import { BffAppContext, fromBffAppContext } from "../utilities/context.js";
import { config } from "../config/config.js";

export function purposeTemplateConfigFeatureIsEnabled(
  ctx: WithLogger<BffAppContext>
): Problem | void {
  if (!isFeatureFlagEnabled(config, "featureFlagPurposeTemplate")) {
    return makeApiProblem(
      featureFlagNotEnabled("featureFlagPurposeTemplate"),
      () => constants.HTTP_STATUS_FORBIDDEN,
      ctx,
      "Purpose Template feature flag is disabled, operation not allowed"
    );
  }
}

const purposeTemplateRouter = (
  ctx: ZodiosContext,
  purposeTemplateService: PurposeTemplateService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const purposeTemplateRouter = ctx.router(bffApi.purposeTemplatesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  purposeTemplateRouter.post("/purposeTemplates", async (req, res) => {
    const ctx = fromBffAppContext(req.ctx, req.headers);

    // This is temporary, it verifies feature flag only for a specific route,
    // instead of the entire router with middleware
    const featureFlagError = purposeTemplateConfigFeatureIsEnabled(ctx);
    if (featureFlagError) {
      return res.status(featureFlagError.status).send(featureFlagError);
    }

    try {
      const result = await purposeTemplateService.createPurposeTemplate(
        req.body,
        ctx
      );
      return res.status(201).send(bffApi.CreatedResource.parse(result));
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        emptyErrorMapper,
        ctx,
        "Error creating purpose template"
      );
      return res.status(errorRes.status).send(errorRes);
    }
  });

  return purposeTemplateRouter;
};

export default purposeTemplateRouter;
