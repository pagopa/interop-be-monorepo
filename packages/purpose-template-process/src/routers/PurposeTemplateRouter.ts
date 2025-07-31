import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  authRole,
  ExpressContext,
  fromAppContext,
  validateAuthorization,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { PurposeTemplateService } from "../services/purposeTemplateService.js";

const purposeTemplateRouter = (
  ctx: ZodiosContext,
  _purposeTemplateService: PurposeTemplateService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const purposeTemplateRouter = ctx.router(
    purposeTemplateApi.purposeTemplateApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );

  const {
    ADMIN_ROLE,
    API_ROLE,
    SECURITY_ROLE,
    M2M_ROLE,
    SUPPORT_ROLE,
    M2M_ADMIN_ROLE,
  } = authRole;

  purposeTemplateRouter.get("/purposeTemplates/:id", async (req, res) => {
    const ctx = fromAppContext(req.ctx);

    try {
      validateAuthorization(ctx, [
        ADMIN_ROLE,
        API_ROLE,
        M2M_ROLE,
        M2M_ADMIN_ROLE,
        SECURITY_ROLE,
        SUPPORT_ROLE,
      ]);

      await _purposeTemplateService.getPurposeTemplateById(
        unsafeBrandId(req.params.id),
        ctx
      );

      return res.status(501);
    } catch (error) {
      const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
      return res.status(errorRes.status).send(errorRes);
    }
  });

  return purposeTemplateRouter;
};

export default purposeTemplateRouter;
