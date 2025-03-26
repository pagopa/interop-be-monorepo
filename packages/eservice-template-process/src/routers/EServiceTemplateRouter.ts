import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  ReadModelRepository,
  initDB,
  initFileManager,
  zodiosValidationErrorToApiProblem,
  userRoles,
  authorizationMiddleware,
  fromAppContext,
} from "pagopa-interop-commons";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  EServiceTemplateId,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { config } from "../config/config.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { eserviceTemplateServiceBuilder } from "../services/eserviceTemplateService.js";
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
} from "../model/domain/apiConverter.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);

const eserviceTemplateService = eserviceTemplateServiceBuilder(
  initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  }),
  readModelService,
  initFileManager(config)
);

const eserviceTemplatesRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const { ADMIN_ROLE, API_ROLE, SECURITY_ROLE, M2M_ROLE, SUPPORT_ROLE } =
    userRoles;

  return ctx
    .router(eserviceTemplateApi.processApi.api, {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    })
    .get(
      "/templates",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
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
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const eserviceTemplate =
            await eserviceTemplateService.createEServiceTemplate(req.body, ctx);
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
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/templates/:templateId",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const eserviceTemplate =
            await eserviceTemplateService.getEServiceTemplateById(
              unsafeBrandId(req.params.templateId),
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
            getEServiceTemplateErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
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
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/versions",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
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
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/templates/:templateId/versions/:templateVersionId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
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
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/versions/:templateVersionId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
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
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/versions/:templateVersionId/publish",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
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
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/versions/:templateVersionId/suspend",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
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
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/versions/:templateVersionId/activate",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
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
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/versions/:templateVersionId/quotas/update",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
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
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/versions/:templateVersionId/documents",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
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
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/templates/:templateId/versions/:templateVersionId/documents/:documentId",
      authorizationMiddleware([API_ROLE, ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { templateId, templateVersionId, documentId } = req.params;

          const eServiceTemplateDocument =
            await eserviceTemplateService.getEServiceTemplateDocument(
              {
                eServiceTemplateId: unsafeBrandId(templateId),
                eServiceTemplateVersionId: unsafeBrandId(templateVersionId),
                eServiceDocumentId: unsafeBrandId(documentId),
              },
              ctx
            );
          return res.status(200).send(eServiceTemplateDocument);
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getEServiceTemplateDocumentErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/templates/:templateId/versions/:templateVersionId/documents/:documentId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
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
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/versions/:templateVersionId/documents/:documentId/update",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
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
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/riskAnalysis",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await eserviceTemplateService.createRiskAnalysis(
            unsafeBrandId(req.params.templateId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createRiskAnalysisErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/riskAnalysis/:riskAnalysisId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
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
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/templates/:templateId/riskAnalysis/:riskAnalysisId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await eserviceTemplateService.deleteRiskAnalysis(
            unsafeBrandId(req.params.templateId),
            unsafeBrandId(req.params.riskAnalysisId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteRiskAnalysisErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/intendedTarget/update",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
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
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/description/update",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
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
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/name/update",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
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
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/versions/:templateVersionId/attributes/update",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
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
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/creators",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
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
          const errorRes = makeApiProblem(
            error,
            () => 500,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );
};
export default eserviceTemplatesRouter;
