/* eslint-disable sonarjs/no-identical-functions */
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  authRole,
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  validateAuthorization,
} from "pagopa-interop-commons";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";
import { PurposeTemplateService } from "../services/purposeTemplateService.js";
import { sendDownloadedDocumentAsFormData } from "../utils/fileDownload.js";
import { getPurposeTemplateRiskAnalysisErrorMapper } from "../utils/errorMappers.js";

const purposeTemplateRouter = (
  ctx: ZodiosContext,
  purposeTemplateService: PurposeTemplateService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const { M2M_ADMIN_ROLE, M2M_ROLE } = authRole;

  const purposeTemplateRouter = ctx.router(
    m2mGatewayApi.purposeTemplatesApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );

  purposeTemplateRouter
    .get("/purposeTemplates", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const purposeTemplates =
          await purposeTemplateService.getPurposeTemplates(req.query, ctx);

        return res
          .status(200)
          .send(m2mGatewayApi.PurposeTemplates.parse(purposeTemplates));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving purpose templates`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/purposeTemplates/:purposeTemplateId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const purposeTemplate = await purposeTemplateService.getPurposeTemplate(
          unsafeBrandId(req.params.purposeTemplateId),
          ctx
        );

        return res
          .status(200)
          .send(m2mGatewayApi.PurposeTemplate.parse(purposeTemplate));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving purpose template with id ${req.params.purposeTemplateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/purposeTemplates/:purposeTemplateId/riskAnalysis",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

          const riskAnalysisFormTemplate =
            await purposeTemplateService.getPurposeTemplateRiskAnalysis(
              unsafeBrandId(req.params.purposeTemplateId),
              ctx
            );

          return res
            .status(200)
            .send(
              m2mGatewayApi.RiskAnalysisFormTemplate.parse(
                riskAnalysisFormTemplate
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getPurposeTemplateRiskAnalysisErrorMapper,
            ctx,
            `Error retrieving risk analysis for purpose template with id ${req.params.purposeTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/purposeTemplates/:purposeTemplateId/riskAnalysis/annotationDocuments",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

          const documents =
            await purposeTemplateService.getRiskAnalysisTemplateAnnotationDocuments(
              unsafeBrandId(req.params.purposeTemplateId),
              req.query,
              ctx
            );

          return res
            .status(200)
            .send(
              m2mGatewayApi.RiskAnalysisTemplateAnnotationDocuments.parse(
                documents
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error retrieving annotation documents for purpose template ${req.params.purposeTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/purposeTemplates/:purposeTemplateId/riskAnalysis/annotationDocuments/:documentId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

          const file =
            await purposeTemplateService.downloadRiskAnalysisTemplateAnswerAnnotationDocument(
              unsafeBrandId(req.params.purposeTemplateId),
              unsafeBrandId(req.params.documentId),
              ctx
            );

          return sendDownloadedDocumentAsFormData(file, res);
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error retrieving risk analysis template answer annotation document ${req.params.documentId} for purpose template ${req.params.purposeTemplateId}`
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get("/purposeTemplates/:purposeTemplateId/eservices", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const purposeTemplateEServices =
          await purposeTemplateService.getPurposeTemplateEServices(
            unsafeBrandId(req.params.purposeTemplateId),
            req.query,
            ctx
          );

        return res
          .status(200)
          .send(m2mGatewayApi.EServices.parse(purposeTemplateEServices));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving purpose template e-services for purpose template ${req.params.purposeTemplateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/purposeTemplates/:purposeTemplateId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        await purposeTemplateService.deletePurposeTemplate(
          unsafeBrandId(req.params.purposeTemplateId),
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error deleting purpose template with id ${req.params.purposeTemplateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return purposeTemplateRouter;
};

export default purposeTemplateRouter;
