import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { bffApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { PurposeTemplateService } from "../services/purposeTemplateService.js";
import { fromBffAppContext } from "../utilities/context.js";

const purposeTemplateRouter = (
  ctx: ZodiosContext,
  purposeTemplateService: PurposeTemplateService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const purposeTemplateRouter = ctx.router(bffApi.purposeTemplatesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  purposeTemplateRouter
    .post("/purposeTemplates", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

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
    })
    .put("/purposeTemplates/:purposeTemplateId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      const purposeTemplateId = unsafeBrandId(req.params.purposeTemplateId);
      try {
        const result = await purposeTemplateService.updatePurposeTemplate(
          purposeTemplateId,
          req.body,
          ctx
        );
        return res.status(200).send(bffApi.PurposeTemplate.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error updating purpose template ${purposeTemplateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });
  return purposeTemplateRouter;
};

export default purposeTemplateRouter;
