import { constants } from "http2";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import {
  authRole,
  ExpressContext,
  validateAuthorization,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import {
  toBffCreatedEServiceTemplateVersion,
  toCatalogCreateEServiceTemplateSeed,
} from "../api/eserviceTemplateApiConverter.js";
import { makeApiProblem } from "../model/errors.js";
import { EServiceTemplateService } from "../services/eserviceTemplateService.js";
import { fromBffAppContext } from "../utilities/context.js";
import {
  bffGetCatalogEServiceTemplateErrorMapper,
  bffGetEServiceTemplateErrorMapper,
  createEServiceTemplateDocumentErrorMapper,
} from "../utilities/errorMappers.js";

const eserviceTemplateRouter = (
  ctx: ZodiosContext,
  eserviceTemplateService: EServiceTemplateService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const eserviceTemplateRouter = ctx.router(bffApi.eserviceTemplatesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  eserviceTemplateRouter
    .post("/eservices/templates", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const eserviceTemplate =
          await eserviceTemplateService.createEServiceTemplate(
            toCatalogCreateEServiceTemplateSeed(req.body),
            ctx
          );
        return res
          .status(200)
          .send(
            bffApi.CreatedEServiceTemplateVersion.parse(
              toBffCreatedEServiceTemplateVersion(eserviceTemplate)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error creating eservice template"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/eservices/templates/:eServiceTemplateId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const eserviceTemplate =
          await eserviceTemplateService.getEServiceTemplate(
            unsafeBrandId(req.params.eServiceTemplateId),
            ctx
          );
        return res
          .status(200)
          .send(bffApi.EServiceTemplateDetails.parse(eserviceTemplate));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving eservice template ${req.params.eServiceTemplateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/eservices/templates/:eServiceTemplateId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await eserviceTemplateService.updateEServiceTemplate(
          unsafeBrandId(req.params.eServiceTemplateId),
          req.body,
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error updating eservice template ${req.params.eServiceTemplateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { eServiceTemplateId, eServiceTemplateVersionId } = req.params;

        try {
          await eserviceTemplateService.updateDraftTemplateVersion(
            unsafeBrandId(eServiceTemplateId),
            unsafeBrandId(eServiceTemplateVersionId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating draft version ${eServiceTemplateVersionId} for eservice template ${eServiceTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/suspend",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { eServiceTemplateId, eServiceTemplateVersionId } = req.params;

        try {
          await eserviceTemplateService.suspendEServiceTemplateVersion(
            unsafeBrandId(eServiceTemplateId),
            unsafeBrandId(eServiceTemplateVersionId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error suspending version ${eServiceTemplateVersionId} for eservice template ${eServiceTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/activate",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { eServiceTemplateId, eServiceTemplateVersionId } = req.params;

        try {
          await eserviceTemplateService.activateEServiceTemplateVersion(
            unsafeBrandId(eServiceTemplateId),
            unsafeBrandId(eServiceTemplateVersionId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error activating version ${eServiceTemplateVersionId} for eservice template ${eServiceTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/publish",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { eServiceTemplateId, eServiceTemplateVersionId } = req.params;

        try {
          await eserviceTemplateService.publishEServiceTemplateVersion(
            unsafeBrandId(eServiceTemplateId),
            unsafeBrandId(eServiceTemplateVersionId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error publishing version ${eServiceTemplateVersionId} for eservice template ${eServiceTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { eServiceTemplateId, eServiceTemplateVersionId } = req.params;

        try {
          await eserviceTemplateService.deleteEServiceTemplateVersion(
            unsafeBrandId(eServiceTemplateId),
            unsafeBrandId(eServiceTemplateVersionId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error deleting eservice template ${eServiceTemplateId} version ${eServiceTemplateVersionId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/name/update",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { eServiceTemplateId } = req.params;

        try {
          await eserviceTemplateService.updateEServiceTemplateName(
            unsafeBrandId(eServiceTemplateId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating eservice template ${eServiceTemplateId} name`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/intendedTarget/update",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { eServiceTemplateId } = req.params;

        try {
          await eserviceTemplateService.updateEServiceTemplateIntendedTarget(
            unsafeBrandId(eServiceTemplateId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating eservice template ${eServiceTemplateId} description`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/description/update",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { eServiceTemplateId } = req.params;

        try {
          await eserviceTemplateService.updateEServiceTemplateDescription(
            unsafeBrandId(eServiceTemplateId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating eservice template ${eServiceTemplateId} e-service description`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { eServiceTemplateId, eServiceTemplateVersionId } = req.params;

        try {
          const response =
            await eserviceTemplateService.getEServiceTemplateVersion(
              unsafeBrandId(eServiceTemplateId),
              unsafeBrandId(eServiceTemplateVersionId),
              ctx
            );
          return res
            .status(200)
            .send(bffApi.EServiceTemplateVersionDetails.parse(response));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            bffGetEServiceTemplateErrorMapper,
            ctx,
            `Error retrieving version ${eServiceTemplateVersionId} for eservice template ${eServiceTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/personalDataFlag",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          await eserviceTemplateService.updateEServiceTemplatePersonalDataFlag(
            ctx,
            unsafeBrandId(req.params.eServiceTemplateId),
            req.body
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error setting personalData flag for eservice template ${req.params.eServiceTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get("/catalog/eservices/templates", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      const { q, creatorsIds, personalData, offset, limit } = req.query;

      try {
        const response =
          await eserviceTemplateService.getCatalogEServiceTemplates(
            q,
            creatorsIds,
            personalData,
            offset,
            limit,
            ctx
          );

        return res
          .status(200)
          .send(bffApi.CatalogEServiceTemplates.parse(response));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          bffGetCatalogEServiceTemplateErrorMapper,
          ctx,
          "Error retrieving Catalog eservice templates"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/creators/eservices/templates", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      const { q, offset, limit } = req.query;

      try {
        const response =
          await eserviceTemplateService.getCreatorEServiceTemplates(
            q,
            offset,
            limit,
            ctx
          );

        return res
          .status(200)
          .send(bffApi.ProducerEServiceTemplates.parse(response));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error retrieving producer eservice templates"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/quotas/update",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { eServiceTemplateId, eServiceTemplateVersionId } = req.params;

        try {
          await eserviceTemplateService.updateEServiceTemplateVersionQuotas(
            unsafeBrandId(eServiceTemplateId),
            unsafeBrandId(eServiceTemplateVersionId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating eservice template ${eServiceTemplateId} version ${eServiceTemplateVersionId} quotas`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/riskAnalysis",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { eServiceTemplateId } = req.params;

        try {
          await eserviceTemplateService.createEServiceTemplateRiskAnalysis(
            unsafeBrandId(eServiceTemplateId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error creating eservice template ${eServiceTemplateId} risk analysis`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/riskAnalysis/:riskAnalysisId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { eServiceTemplateId, riskAnalysisId } = req.params;

        try {
          await eserviceTemplateService.updateEServiceTemplateRiskAnalysis(
            unsafeBrandId(eServiceTemplateId),
            unsafeBrandId(riskAnalysisId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating eservice template ${eServiceTemplateId} risk analysis ${riskAnalysisId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/eservices/templates/:eServiceTemplateId/riskAnalysis/:riskAnalysisId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { eServiceTemplateId, riskAnalysisId } = req.params;

        try {
          await eserviceTemplateService.deleteEServiceTemplateEServiceRiskAnalysis(
            unsafeBrandId(eServiceTemplateId),
            unsafeBrandId(riskAnalysisId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error deleting eservice template ${eServiceTemplateId} risk analysis ${riskAnalysisId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/attributes/update",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { eServiceTemplateId, eServiceTemplateVersionId } = req.params;

        try {
          await eserviceTemplateService.updateEServiceTemplateVersionAttributes(
            unsafeBrandId(eServiceTemplateId),
            unsafeBrandId(eServiceTemplateVersionId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating eservice template ${eServiceTemplateId} version ${eServiceTemplateVersionId} attributes`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/versions",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { eServiceTemplateId } = req.params;

        try {
          const { id } =
            await eserviceTemplateService.createEServiceTemplateVersion(
              unsafeBrandId(eServiceTemplateId),
              ctx
            );
          return res.status(200).send(bffApi.CreatedResource.parse({ id }));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error creating new eservice template ${eServiceTemplateId} version`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get("/eservices/templates/filter/creators", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      const { offset, limit, q } = req.query;
      try {
        const result =
          await eserviceTemplateService.getEServiceTemplateCreators(
            {
              creatorName: q,
              offset,
              limit,
            },
            ctx
          );
        return res.status(200).send(bffApi.CompactOrganizations.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving e-service template creators filtered by creator name ${q}, offset ${offset}, limit ${limit}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [authRole.ADMIN_ROLE, authRole.API_ROLE]);

          const resp =
            await eserviceTemplateService.createEServiceTemplateDocument(
              unsafeBrandId(req.params.eServiceTemplateId),
              unsafeBrandId(req.params.eServiceTemplateVersionId),
              req.body,
              ctx
            );
          return res.status(200).send(bffApi.CreatedResource.parse(resp));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createEServiceTemplateDocumentErrorMapper,
            ctx,
            `Error creating eService template document of kind ${req.body.kind} and name ${req.body.prettyName} for eService template ${req.params.eServiceTemplateId} and version ${req.params.eServiceTemplateVersionId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents/:documentId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          const { contentType, document } =
            await eserviceTemplateService.getEServiceTemplateDocument(
              unsafeBrandId(req.params.eServiceTemplateId),
              unsafeBrandId(req.params.eServiceTemplateVersionId),
              unsafeBrandId(req.params.documentId),
              ctx
            );
          return res
            .header(constants.HTTP2_HEADER_CONTENT_TYPE, contentType)
            .status(200)
            .send(document);
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error getting eService template document ${req.params.documentId} for eService template ${req.params.eServiceTemplateId} and version ${req.params.eServiceTemplateVersionId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents/:documentId/update",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          await eserviceTemplateService.updateEServiceTemplateDocumentById(
            unsafeBrandId(req.params.eServiceTemplateId),
            unsafeBrandId(req.params.eServiceTemplateVersionId),
            unsafeBrandId(req.params.documentId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating eService template document ${req.params.documentId} for eService template ${req.params.eServiceTemplateId} and version ${req.params.eServiceTemplateVersionId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/eservices/templates/:eServiceTemplateId/versions/:eServiceTemplateVersionId/documents/:documentId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          await eserviceTemplateService.deleteEServiceTemplateDocumentById(
            unsafeBrandId(req.params.eServiceTemplateId),
            unsafeBrandId(req.params.eServiceTemplateVersionId),
            unsafeBrandId(req.params.documentId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error deleting eService template document ${req.params.documentId} for eService template ${req.params.eServiceTemplateId} and version ${req.params.eServiceTemplateVersionId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return eserviceTemplateRouter;
};

export default eserviceTemplateRouter;
