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
import { getPurposeTemplateErrorMapper } from "../utilities/errorMappers.js";

const purposeTemplateRouter = (
  ctx: ZodiosContext,
  purposeTemplateService: PurposeTemplateService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const purposeTemplateRouter = ctx.router(bffApi.purposeTemplatesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  purposeTemplateRouter.post("/purposeTemplates", async (req, res) => {
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
        getPurposeTemplateErrorMapper,
        ctx,
        "Error creating purpose template"
      );
      return res.status(errorRes.status).send(errorRes);
    }
  });

  purposeTemplateRouter.post(
    "/purposeTemplates/:purposeTemplateId/riskAnalysis/answers",
    async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await purposeTemplateService.createRiskAnalysisAnswer(
          unsafeBrandId(req.params.purposeTemplateId),
          req.body,
          ctx
        );
        return res
          .status(200)
          .send(bffApi.RiskAnalysisTemplateAnswer.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getPurposeTemplateErrorMapper,
          ctx,
          "Error creating risk analysis answer for purpose template"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );
  purposeTemplateRouter.put(
    "/purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation",
    async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result =
          await purposeTemplateService.addRiskAnalysisAnswerAnnotation(
            unsafeBrandId(req.params.purposeTemplateId),
            unsafeBrandId(req.params.answerId),
            req.body,
            ctx
          );
        return res
          .status(200)
          .send(bffApi.RiskAnalysisTemplateAnswerAnnotation.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error adding risk analysis answer annotation for purpose template"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  return purposeTemplateRouter;
};

export default purposeTemplateRouter;
