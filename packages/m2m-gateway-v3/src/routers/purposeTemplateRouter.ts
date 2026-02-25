/* eslint-disable sonarjs/no-identical-functions */
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
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
    m2mGatewayApiV3.purposeTemplatesApi.api,
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
          .send(m2mGatewayApiV3.PurposeTemplates.parse(purposeTemplates));
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
          .send(m2mGatewayApiV3.PurposeTemplate.parse(purposeTemplate));
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
              m2mGatewayApiV3.RiskAnalysisFormTemplate.parse(
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
    .put(
      "/purposeTemplates/:purposeTemplateId/riskAnalysis",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          const riskAnalysisFormTemplate =
            await purposeTemplateService.replacePurposeTemplateRiskAnalysis(
              unsafeBrandId(req.params.purposeTemplateId),
              req.body,
              ctx
            );

          return res
            .status(200)
            .send(
              m2mGatewayApiV3.RiskAnalysisFormTemplate.parse(
                riskAnalysisFormTemplate
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating risk analysis form template for purpose template with id ${req.params.purposeTemplateId}`
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
              m2mGatewayApiV3.RiskAnalysisTemplateAnnotationDocuments.parse(
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
    .post(
      "/purposeTemplates/:purposeTemplateId/riskAnalysis/annotationDocuments",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          const document =
            await purposeTemplateService.uploadRiskAnalysisTemplateAnswerAnnotationDocument(
              unsafeBrandId(req.params.purposeTemplateId),
              req.body,
              ctx
            );

          return res.status(201).send(m2mGatewayApiV3.Document.parse(document));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error uploading annotation document for purpose template ${req.params.purposeTemplateId}`
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

          return sendDownloadedDocumentAsFormData(file, res, ctx);
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
          .send(m2mGatewayApiV3.EServices.parse(purposeTemplateEServices));
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
    .post(
      "/purposeTemplates/:purposeTemplateId/eservices",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          await purposeTemplateService.addPurposeTemplateEService(
            unsafeBrandId(req.params.purposeTemplateId),
            req.body,
            ctx
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error linking e-services to purpose template ${req.params.purposeTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/purposeTemplates/:purposeTemplateId/eservices/:eserviceId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          await purposeTemplateService.removePurposeTemplateEService(
            unsafeBrandId(req.params.purposeTemplateId),
            unsafeBrandId(req.params.eserviceId),
            ctx
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error unlinking e-service ${req.params.eserviceId} from purpose template ${req.params.purposeTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/purposeTemplates/:purposeTemplateId/publish", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const purposeTemplate =
          await purposeTemplateService.publishPurposeTemplate(
            unsafeBrandId(req.params.purposeTemplateId),
            ctx
          );

        return res
          .status(200)
          .send(m2mGatewayApiV3.PurposeTemplate.parse(purposeTemplate));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error publishing purpose template ${req.params.purposeTemplateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates/:purposeTemplateId/archive", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const purposeTemplate =
          await purposeTemplateService.archivePurposeTemplate(
            unsafeBrandId(req.params.purposeTemplateId),
            ctx
          );

        return res
          .status(200)
          .send(m2mGatewayApiV3.PurposeTemplate.parse(purposeTemplate));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error archiving purpose template ${req.params.purposeTemplateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/purposeTemplates/:purposeTemplateId/unsuspend",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          const purposeTemplate =
            await purposeTemplateService.unsuspendPurposeTemplate(
              unsafeBrandId(req.params.purposeTemplateId),
              ctx
            );

          return res
            .status(200)
            .send(m2mGatewayApiV3.PurposeTemplate.parse(purposeTemplate));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error unsuspending purpose template ${req.params.purposeTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/purposeTemplates/:purposeTemplateId/suspend", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const purposeTemplate =
          await purposeTemplateService.suspendPurposeTemplate(
            unsafeBrandId(req.params.purposeTemplateId),
            ctx
          );

        return res
          .status(200)
          .send(m2mGatewayApiV3.PurposeTemplate.parse(purposeTemplate));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error suspending purpose template ${req.params.purposeTemplateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const purposeTemplate =
          await purposeTemplateService.createPurposeTemplate(req.body, ctx);

        return res
          .status(201)
          .send(m2mGatewayApiV3.PurposeTemplate.parse(purposeTemplate));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating purpose template`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .patch("/purposeTemplates/:purposeTemplateId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const purposeTemplate =
          await purposeTemplateService.updateDraftPurposeTemplate(
            unsafeBrandId(req.params.purposeTemplateId),
            req.body,
            ctx
          );

        return res
          .status(200)
          .send(m2mGatewayApiV3.PurposeTemplate.parse(purposeTemplate));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error updating purpose template with id ${req.params.purposeTemplateId}`
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
    })
    .delete(
      "/purposeTemplates/:purposeTemplateId/riskAnalysis/annotationDocuments/:documentId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          await purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
            unsafeBrandId(req.params.purposeTemplateId),
            unsafeBrandId(req.params.documentId),
            ctx
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error deleting risk analysis template answer annotation document ${req.params.documentId} for purpose template ${req.params.purposeTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return purposeTemplateRouter;
};

export default purposeTemplateRouter;
