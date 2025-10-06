import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  authRole,
  validateAuthorization,
} from "pagopa-interop-commons";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { EserviceTemplateService } from "../services/eserviceTemplateService.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";
import {
  deleteDraftEServiceTemplateVersionErrorMapper,
  getEServiceTemplateRiskAnalysisErrorMapper,
  getEServiceTemplateVersionErrorMapper,
  getEServiceTemplateVersionDocumentsErrorMapper,
} from "../utils/errorMappers.js";
import { sendDownloadedDocumentAsFormData } from "../utils/fileDownload.js";

const eserviceTemplateRouter = (
  ctx: ZodiosContext,
  eserviceTemplateService: EserviceTemplateService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const { M2M_ROLE, M2M_ADMIN_ROLE } = authRole;

  const eserviceTemplateRouter = ctx.router(
    m2mGatewayApi.eserviceTemplatesApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );

  eserviceTemplateRouter
    .get("/eserviceTemplates", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const templates = await eserviceTemplateService.getEServiceTemplates(
          req.query,
          ctx
        );

        return res
          .status(200)
          .send(m2mGatewayApi.EServiceTemplates.parse(templates));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving templates`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/eserviceTemplates", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const template = await eserviceTemplateService.createEServiceTemplate(
          req.body,
          ctx
        );

        return res
          .status(201)
          .send(m2mGatewayApi.EServiceTemplate.parse(template));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating template`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/eserviceTemplates/:templateId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const template = await eserviceTemplateService.getEServiceTemplateById(
          unsafeBrandId(req.params.templateId),
          ctx
        );

        return res
          .status(200)
          .send(m2mGatewayApi.EServiceTemplate.parse(template));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving eservice template with id ${req.params.templateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .patch("/eserviceTemplates/:templateId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const eserviceTemplate =
          await eserviceTemplateService.updateDraftEServiceTemplate(
            unsafeBrandId(req.params.templateId),
            req.body,
            ctx
          );

        return res
          .status(200)
          .send(m2mGatewayApi.EServiceTemplate.parse(eserviceTemplate));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error updating eservice with id ${req.params.templateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .patch("/eserviceTemplates/:templateId/description", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const template =
          await eserviceTemplateService.updatePublishedEServiceTemplateDescription(
            unsafeBrandId(req.params.templateId),
            req.body,
            ctx
          );

        return res
          .status(200)
          .send(m2mGatewayApi.EServiceTemplate.parse(template));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error updating eservice template ${req.params.templateId} description`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .patch(
      "/eserviceTemplates/:templateId/intendedTarget",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          const template =
            await eserviceTemplateService.updatePublishedEServiceTemplateIntendedTarget(
              unsafeBrandId(req.params.templateId),
              req.body,
              ctx
            );

          return res
            .status(200)
            .send(m2mGatewayApi.EServiceTemplate.parse(template));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating eservice template ${req.params.templateId} intended target`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .patch("/eserviceTemplates/:templateId/name", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const template =
          await eserviceTemplateService.updatePublishedEServiceTemplateName(
            unsafeBrandId(req.params.templateId),
            req.body,
            ctx
          );

        return res
          .status(200)
          .send(m2mGatewayApi.EServiceTemplate.parse(template));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error updating eservice template ${req.params.templateId} name`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/eserviceTemplates/:templateId/versions", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const versions =
          await eserviceTemplateService.getEServiceTemplateVersions(
            unsafeBrandId(req.params.templateId),
            req.query,
            ctx
          );

        return res
          .status(200)
          .send(m2mGatewayApi.EServiceTemplateVersions.parse(versions));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving eservice template ${req.params.templateId} versions`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete(
      "/eserviceTemplates/:templateId/versions/:versionId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          await eserviceTemplateService.deleteDraftEServiceTemplateVersion(
            unsafeBrandId(req.params.templateId),
            unsafeBrandId(req.params.versionId),
            ctx
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteDraftEServiceTemplateVersionErrorMapper,
            ctx,
            `Error deleting eservice template ${req.params.templateId} version ${req.params.versionId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .patch(
      "/eserviceTemplates/:templateId/versions/:versionId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          const version =
            await eserviceTemplateService.updateDraftEServiceTemplateVersion(
              unsafeBrandId(req.params.templateId),
              unsafeBrandId(req.params.versionId),
              req.body,
              ctx
            );

          return res
            .status(200)
            .send(m2mGatewayApi.EServiceTemplateVersion.parse(version));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating eservice template ${req.params.templateId} version ${req.params.versionId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/eserviceTemplates/:templateId/versions/:versionId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

          const version =
            await eserviceTemplateService.getEServiceTemplateVersion(
              unsafeBrandId(req.params.templateId),
              unsafeBrandId(req.params.versionId),
              ctx
            );

          return res
            .status(200)
            .send(m2mGatewayApi.EServiceTemplateVersion.parse(version));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getEServiceTemplateVersionErrorMapper,
            ctx,
            `Error retrieving eservice template ${req.params.templateId} version ${req.params.versionId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/eserviceTemplates/:templateId/versions", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const version =
          await eserviceTemplateService.createEserviceTemplateVersion(
            unsafeBrandId(req.params.templateId),
            req.body,
            ctx
          );

        return res
          .status(200)
          .send(m2mGatewayApi.EServiceTemplateVersion.parse(version));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating eservice template ${req.params.templateId} version`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/eserviceTemplates/:templateId/versions/:versionId/suspend",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          const version =
            await eserviceTemplateService.suspendEServiceTemplateVersion(
              unsafeBrandId(req.params.templateId),
              unsafeBrandId(req.params.versionId),
              ctx
            );

          return res
            .status(200)
            .send(m2mGatewayApi.EServiceTemplateVersion.parse(version));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error suspending eservice template ${req.params.templateId} version ${req.params.versionId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eserviceTemplates/:templateId/versions/:versionId/unsuspend",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          const version =
            await eserviceTemplateService.unsuspendEServiceTemplateVersion(
              unsafeBrandId(req.params.templateId),
              unsafeBrandId(req.params.versionId),
              ctx
            );

          return res
            .status(200)
            .send(m2mGatewayApi.EServiceTemplateVersion.parse(version));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error unsuspending eservice template ${req.params.templateId} version ${req.params.versionId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eserviceTemplates/:templateId/versions/:versionId/publish",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          const version =
            await eserviceTemplateService.publishEServiceTemplateVersion(
              unsafeBrandId(req.params.templateId),
              unsafeBrandId(req.params.versionId),
              ctx
            );

          return res
            .status(200)
            .send(m2mGatewayApi.EServiceTemplateVersion.parse(version));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error publishing eservice template ${req.params.templateId} version ${req.params.versionId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .patch(
      "/eserviceTemplates/:templateId/versions/:versionId/quotas",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          const version =
            await eserviceTemplateService.updatePublishedEServiceTemplateVersionQuotas(
              unsafeBrandId(req.params.templateId),
              unsafeBrandId(req.params.versionId),
              req.body,
              ctx
            );

          return res
            .status(200)
            .send(m2mGatewayApi.EServiceTemplateVersion.parse(version));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating quotas for eservice template version with id ${req.params.versionId} for eservice template ${req.params.templateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/eserviceTemplates/:templateId/riskAnalyses", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const riskAnalysis =
          await eserviceTemplateService.createEServiceTemplateRiskAnalysis(
            unsafeBrandId(req.params.templateId),
            req.body,
            ctx
          );
        return res
          .status(201)
          .send(m2mGatewayApi.EServiceTemplateRiskAnalysis.parse(riskAnalysis));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating risk analysis for eservice template with id ${req.params.templateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/eserviceTemplates/:templateId/versions/:versionId/documents",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

          const documents =
            await eserviceTemplateService.getEServiceTemplateVersionDocuments(
              unsafeBrandId(req.params.templateId),
              unsafeBrandId(req.params.versionId),
              req.query,
              ctx
            );

          return res.status(200).send(m2mGatewayApi.Documents.parse(documents));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getEServiceTemplateVersionDocumentsErrorMapper,
            ctx,
            `Error retrieving documents for eservice template ${req.params.templateId} version with id ${req.params.versionId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eserviceTemplates/:templateId/versions/:versionId/documents",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);
          const document =
            await eserviceTemplateService.uploadEServiceTemplateVersionDocument(
              unsafeBrandId(req.params.templateId),
              unsafeBrandId(req.params.versionId),
              req.body,
              ctx
            );

          return res.status(201).send(m2mGatewayApi.Document.parse(document));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error uploading document for eservice template ${req.params.templateId} version with id ${req.params.versionId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/eserviceTemplates/:templateId/versions/:versionId/documents/:documentId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);
          const file =
            await eserviceTemplateService.downloadEServiceTemplateVersionDocument(
              unsafeBrandId(req.params.templateId),
              unsafeBrandId(req.params.versionId),
              unsafeBrandId(req.params.documentId),
              ctx
            );

          return sendDownloadedDocumentAsFormData(file, res);
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error retrieving document with id ${req.params.documentId} for eservice template ${req.params.templateId} version with id ${req.params.versionId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/eserviceTemplates/:templateId/versions/:versionId/documents/:documentId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          await eserviceTemplateService.deleteEServiceTemplateVersionDocument(
            unsafeBrandId(req.params.templateId),
            unsafeBrandId(req.params.versionId),
            unsafeBrandId(req.params.documentId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error deleting document with id ${req.params.documentId} for eservice template ${req.params.templateId} version with id ${req.params.versionId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get("/eserviceTemplates/:templateId/riskAnalyses", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const riskAnalysis =
          await eserviceTemplateService.getEServiceTemplateRiskAnalyses(
            unsafeBrandId(req.params.templateId),
            req.query,
            ctx
          );
        return res
          .status(200)
          .send(m2mGatewayApi.EServiceTemplateRiskAnalyses.parse(riskAnalysis));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving risk analyses for eservice template with id ${req.params.templateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/eserviceTemplates/:templateId/riskAnalyses/:riskAnalysisId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

          const riskAnalysis =
            await eserviceTemplateService.getEServiceTemplateRiskAnalysis(
              unsafeBrandId(req.params.templateId),
              unsafeBrandId(req.params.riskAnalysisId),
              ctx
            );
          return res
            .status(200)
            .send(
              m2mGatewayApi.EServiceTemplateRiskAnalysis.parse(riskAnalysis)
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getEServiceTemplateRiskAnalysisErrorMapper,
            ctx,
            `Error retrieving risk analysis ${req.params.riskAnalysisId} for eservice template with id ${req.params.templateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/eserviceTemplates/:templateId/riskAnalyses/:riskAnalysisId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          await eserviceTemplateService.deleteEServiceTemplateRiskAnalysis(
            unsafeBrandId(req.params.templateId),
            unsafeBrandId(req.params.riskAnalysisId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error deleting risk analysis ${req.params.riskAnalysisId} for eservice template with id ${req.params.templateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return eserviceTemplateRouter;
};

export default eserviceTemplateRouter;
