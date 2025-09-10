import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
  fromAppContext,
  authRole,
  validateAuthorization,
  setMetadataVersionHeader,
} from "pagopa-interop-commons";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  EServiceTemplateId,
  TenantId,
  emptyErrorMapper,
  unsafeBrandId,
} from "pagopa-interop-models";
import { EServiceTemplateService } from "../services/eserviceTemplateService.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  activateEServiceTemplateVersionErrorMapper,
  suspendEServiceTemplateVersionErrorMapper,
  updateEServiceTemplateNameErrorMapper,
  updateEServiceTemplateIntendedTargetErrorMapper,
  updateEServiceTemplateDescriptionErrorMapper,
  updateEServiceTemplateVersionQuotasErrorMapper,
  updateEServiceTemplateVersionAttributesErrorMapper,
  createEServiceTemplateVersionErrorMapper,
  getEServiceTemplateErrorMapper,
  createRiskAnalysisErrorMapper,
  deleteRiskAnalysisErrorMapper,
  updateRiskAnalysisErrorMapper,
  deleteEServiceTemplateVersionErrorMapper,
  createEServiceTemplateErrorMapper,
  updateEServiceTemplateErrorMapper,
  updateDraftTemplateVersionErrorMapper,
  publishEServiceTemplateVersionErrorMapper,
  createEServiceTemplateDocumentErrorMapper,
  getEServiceTemplateDocumentErrorMapper,
  updateDocumentErrorMapper,
  deleteDocumentErrorMapper,
  getEServiceTemplatesErrorMapper,
} from "../utilities/errorMappers.js";
import {
  eserviceTemplateToApiEServiceTemplate,
  eserviceTemplateVersionToApiEServiceTemplateVersion,
  apiEServiceTemplateVersionStateToEServiceTemplateVersionState,
  documentToApiDocument,
} from "../model/domain/apiConverter.js";

const eserviceTemplatesRouter = (
  ctx: ZodiosContext,
  eserviceTemplateService: EServiceTemplateService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const {
    ADMIN_ROLE,
    API_ROLE,
    SECURITY_ROLE,
    M2M_ROLE,
    SUPPORT_ROLE,
    M2M_ADMIN_ROLE,
  } = authRole;

  return ctx
    .router(eserviceTemplateApi.processApi.api, {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    })
    .get("/templates", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          SUPPORT_ROLE,
          M2M_ADMIN_ROLE,
        ]);

        const {
          name,
          creatorsIds,
          eserviceTemplatesIds,
          states,
          offset,
          limit,
        } = req.query;

        const eserviceTemplates =
          await eserviceTemplateService.getEServiceTemplates(
            {
              eserviceTemplatesIds:
                eserviceTemplatesIds.map<EServiceTemplateId>(unsafeBrandId),
              creatorsIds: creatorsIds.map<TenantId>(unsafeBrandId),
              states: states.map(
                apiEServiceTemplateVersionStateToEServiceTemplateVersionState
              ),
              name,
            },
            offset,
            limit,
            ctx
          );

        return res.status(200).send(
          eserviceTemplateApi.EServiceTemplates.parse({
            results: eserviceTemplates.results.map(
              eserviceTemplateToApiEServiceTemplate
            ),
            totalCount: eserviceTemplates.totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getEServiceTemplatesErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/templates", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

        const { data: eserviceTemplate, metadata } =
          await eserviceTemplateService.createEServiceTemplate(req.body, ctx);
        setMetadataVersionHeader(res, metadata);

        return res
          .send(
            eserviceTemplateApi.EServiceTemplate.parse(
              eserviceTemplateToApiEServiceTemplate(eserviceTemplate)
            )
          )
          .status(200);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createEServiceTemplateErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/templates/:templateId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          SUPPORT_ROLE,
          M2M_ADMIN_ROLE,
        ]);

        const { data: eserviceTemplate, metadata } =
          await eserviceTemplateService.getEServiceTemplateById(
            unsafeBrandId(req.params.templateId),
            ctx
          );
        setMetadataVersionHeader(res, metadata);
        return res
          .status(200)
          .send(
            eserviceTemplateApi.EServiceTemplate.parse(
              eserviceTemplateToApiEServiceTemplate(eserviceTemplate)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getEServiceTemplateErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/templates/:templateId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

        const updatedEServiceTemplate =
          await eserviceTemplateService.updateEServiceTemplate(
            unsafeBrandId(req.params.templateId),
            req.body,
            ctx
          );
        return res
          .status(200)
          .send(
            eserviceTemplateApi.EServiceTemplate.parse(
              eserviceTemplateToApiEServiceTemplate(updatedEServiceTemplate)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          updateEServiceTemplateErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/templates/:templateId/versions", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

        const eserviceTemplateVersion =
          await eserviceTemplateService.createEServiceTemplateVersion(
            unsafeBrandId(req.params.templateId),
            ctx
          );
        return res
          .status(200)
          .send(
            eserviceTemplateApi.EServiceTemplateVersion.parse(
              eserviceTemplateVersionToApiEServiceTemplateVersion(
                eserviceTemplateVersion
              )
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createEServiceTemplateVersionErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete(
      "/templates/:templateId/versions/:templateVersionId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

          await eserviceTemplateService.deleteEServiceTemplateVersion(
            unsafeBrandId(req.params.templateId),
            unsafeBrandId(req.params.templateVersionId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteEServiceTemplateVersionErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/versions/:templateVersionId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

          const eserviceTemplate =
            await eserviceTemplateService.updateDraftTemplateVersion(
              unsafeBrandId(req.params.templateId),
              unsafeBrandId(req.params.templateVersionId),
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(
              eserviceTemplateApi.EServiceTemplate.parse(
                eserviceTemplateToApiEServiceTemplate(eserviceTemplate)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateDraftTemplateVersionErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/versions/:templateVersionId/publish",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

          await eserviceTemplateService.publishEServiceTemplateVersion(
            unsafeBrandId(req.params.templateId),
            unsafeBrandId(req.params.templateVersionId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            publishEServiceTemplateVersionErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/versions/:templateVersionId/suspend",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

          await eserviceTemplateService.suspendEServiceTemplateVersion(
            unsafeBrandId(req.params.templateId),
            unsafeBrandId(req.params.templateVersionId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            suspendEServiceTemplateVersionErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/versions/:templateVersionId/activate",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

          await eserviceTemplateService.activateEServiceTemplateVersion(
            unsafeBrandId(req.params.templateId),
            unsafeBrandId(req.params.templateVersionId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            activateEServiceTemplateVersionErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/versions/:templateVersionId/quotas/update",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

          const updatedEServiceTemplate =
            await eserviceTemplateService.updateEServiceTemplateVersionQuotas(
              unsafeBrandId(req.params.templateId),
              unsafeBrandId(req.params.templateVersionId),
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(
              eserviceTemplateApi.EServiceTemplate.parse(
                eserviceTemplateToApiEServiceTemplate(updatedEServiceTemplate)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateEServiceTemplateVersionQuotasErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/versions/:templateVersionId/documents",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          // The same check is done in the backend-for-frontend, if you change this check, change it there too
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

          const updatedEServiceTemplate =
            await eserviceTemplateService.createEServiceTemplateDocument(
              unsafeBrandId(req.params.templateId),
              unsafeBrandId(req.params.templateVersionId),
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(
              eserviceTemplateApi.EServiceTemplate.parse(
                eserviceTemplateToApiEServiceTemplate(updatedEServiceTemplate)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createEServiceTemplateDocumentErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/templates/:templateId/versions/:templateVersionId/documents/:documentId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, SUPPORT_ROLE]);

          const { templateId, templateVersionId, documentId } = req.params;

          const eServiceTemplateDocument =
            await eserviceTemplateService.getEServiceTemplateDocument(
              {
                eServiceTemplateId: unsafeBrandId(templateId),
                eServiceTemplateVersionId: unsafeBrandId(templateVersionId),
                documentId: unsafeBrandId(documentId),
              },
              ctx
            );
          return res
            .status(200)
            .send(documentToApiDocument(eServiceTemplateDocument));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getEServiceTemplateDocumentErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/templates/:templateId/versions/:templateVersionId/documents/:documentId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

          await eserviceTemplateService.deleteDocument(
            unsafeBrandId(req.params.templateId),
            unsafeBrandId(req.params.templateVersionId),
            unsafeBrandId(req.params.documentId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteDocumentErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/versions/:templateVersionId/documents/:documentId/update",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

          await eserviceTemplateService.updateDocument(
            unsafeBrandId(req.params.templateId),
            unsafeBrandId(req.params.templateVersionId),
            unsafeBrandId(req.params.documentId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateDocumentErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/templates/:templateId/riskAnalysis", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

        const {
          data: { eserviceTemplate, createdRiskAnalysisId },
          metadata,
        } = await eserviceTemplateService.createRiskAnalysis(
          unsafeBrandId(req.params.templateId),
          req.body,
          ctx
        );
        setMetadataVersionHeader(res, metadata);
        return res.status(200).send(
          eserviceTemplateApi.CreatedEServiceTemplateRiskAnalysis.parse({
            eserviceTemplate:
              eserviceTemplateToApiEServiceTemplate(eserviceTemplate),
            createdRiskAnalysisId,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createRiskAnalysisErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/templates/:templateId/riskAnalysis/:riskAnalysisId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

          await eserviceTemplateService.updateRiskAnalysis(
            unsafeBrandId(req.params.templateId),
            unsafeBrandId(req.params.riskAnalysisId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateRiskAnalysisErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/templates/:templateId/riskAnalysis/:riskAnalysisId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

          const { metadata } = await eserviceTemplateService.deleteRiskAnalysis(
            unsafeBrandId(req.params.templateId),
            unsafeBrandId(req.params.riskAnalysisId),
            ctx
          );
          setMetadataVersionHeader(res, metadata);
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteRiskAnalysisErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/templates/:templateId/intendedTarget/update", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

        const updatedEServiceTemplate =
          await eserviceTemplateService.updateEServiceTemplateIntendedTarget(
            unsafeBrandId(req.params.templateId),
            req.body.intendedTarget,
            ctx
          );
        return res
          .status(200)
          .send(
            eserviceTemplateApi.EServiceTemplate.parse(
              eserviceTemplateToApiEServiceTemplate(updatedEServiceTemplate)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          updateEServiceTemplateIntendedTargetErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/templates/:templateId/description/update", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

        const updatedEServiceTemplate =
          await eserviceTemplateService.updateEServiceTemplateDescription(
            unsafeBrandId(req.params.templateId),
            req.body.description,
            ctx
          );
        return res
          .status(200)
          .send(
            eserviceTemplateApi.EServiceTemplate.parse(
              eserviceTemplateToApiEServiceTemplate(updatedEServiceTemplate)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          updateEServiceTemplateDescriptionErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/templates/:templateId/name/update", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

        const updatedEServiceTemplate =
          await eserviceTemplateService.updateEServiceTemplateName(
            unsafeBrandId(req.params.templateId),
            req.body.name,
            ctx
          );
        return res
          .status(200)
          .send(
            eserviceTemplateApi.EServiceTemplate.parse(
              eserviceTemplateToApiEServiceTemplate(updatedEServiceTemplate)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          updateEServiceTemplateNameErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/templates/:templateId/versions/:templateVersionId/attributes/update",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

          const updatedEServiceTemplate =
            await eserviceTemplateService.updateEServiceTemplateVersionAttributes(
              unsafeBrandId(req.params.templateId),
              unsafeBrandId(req.params.templateVersionId),
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(
              eserviceTemplateApi.EServiceTemplate.parse(
                eserviceTemplateToApiEServiceTemplate(updatedEServiceTemplate)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateEServiceTemplateVersionAttributesErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get("/creators", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          SUPPORT_ROLE,
        ]);

        const { creatorName, offset, limit } = req.query;

        const { results, totalCount } =
          await eserviceTemplateService.getEServiceTemplateCreators(
            creatorName,
            limit,
            offset,
            ctx
          );

        return res.status(200).send(
          eserviceTemplateApi.CompactOrganizations.parse({
            results,
            totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    });
};
export default eserviceTemplatesRouter;
