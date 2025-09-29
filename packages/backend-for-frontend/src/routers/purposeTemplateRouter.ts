import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { bffApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { makeApiProblem } from "../model/errors.js";
import { PurposeTemplateService } from "../services/purposeTemplateService.js";
import { fromBffAppContext } from "../utilities/context.js";
import {
  getCatalogPurposeTemplatesErrorMapper,
  purposeTemplateFeatureFlagErrorMapper,
} from "../utilities/errorMappers.js";

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
          purposeTemplateFeatureFlagErrorMapper,
          ctx,
          "Error creating purpose template"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/creators/purposeTemplates", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const response =
          await purposeTemplateService.getCreatorPurposeTemplates({
            purposeTitle: req.query.q,
            states: req.query.states,
            eserviceIds: req.query.eserviceIds,
            offset: req.query.offset,
            limit: req.query.limit,
            ctx,
          });

        return res
          .status(200)
          .send(bffApi.CreatorPurposeTemplates.parse(response));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          purposeTemplateFeatureFlagErrorMapper,
          ctx,
          "Error retrieving creator's purpose templates"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/catalog/purposeTemplates", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const response =
          await purposeTemplateService.getCatalogPurposeTemplates({
            purposeTitle: req.query.q,
            targetTenantKind: req.query.targetTenantKind,
            creatorIds: req.query.creatorIds,
            eserviceIds: req.query.eserviceIds,
            excludeExpiredRiskAnalysis: req.query.excludeExpiredRiskAnalysis,
            offset: req.query.offset,
            limit: req.query.limit,
            ctx,
          });

        return res
          .status(200)
          .send(bffApi.CatalogPurposeTemplates.parse(response));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getCatalogPurposeTemplatesErrorMapper,
          ctx,
          "Error retrieving catalog purpose templates"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents/:documentId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          const result =
            await purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocument(
              {
                purposeTemplateId: req.params.purposeTemplateId,
                answerId: req.params.answerId,
                documentId: req.params.documentId,
                ctx,
              }
            );

          return res.status(200).send(result);
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error downloading risk analysis template answer annotation document ${req.params.documentId} for purpose template ${req.params.purposeTemplateId} and answer ${req.params.answerId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return purposeTemplateRouter;
};

export default purposeTemplateRouter;
