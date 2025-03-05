import { constants } from "http2";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  FileManager,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { unsafeBrandId } from "pagopa-interop-models";
import { toBffCreatedEServiceTemplateVersion } from "../api/eserviceTemplateApiConverter.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { emptyErrorMapper, makeApiProblem } from "../model/errors.js";
import { eserviceTemplateServiceBuilder } from "../services/eserviceTemplateService.js";
import { fromBffAppContext } from "../utilities/context.js";
import {
  bffGetCatalogEServiceTemplateErrorMapper,
  bffGetEServiceTemplateErrorMapper,
} from "../utilities/errorMappers.js";
import { BffProcessConfig } from "../config/config.js";

const eserviceTemplateRouter = (
  ctx: ZodiosContext,
  {
    eserviceTemplateProcessClient,
    tenantProcessClient,
    attributeProcessClient,
    catalogProcessClient,
    delegationProcessClient,
  }: PagoPAInteropBeClients,
  fileManager: FileManager,
  bffConfig: BffProcessConfig
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const eserviceTemplateRouter = ctx.router(bffApi.eserviceTemplatesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const eserviceTemplateService = eserviceTemplateServiceBuilder(
    eserviceTemplateProcessClient,
    tenantProcessClient,
    attributeProcessClient,
    catalogProcessClient,
    delegationProcessClient,
    fileManager,
    bffConfig
  );

  eserviceTemplateRouter
    .post("/eservices/templates", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const eserviceTemplate =
          await eserviceTemplateService.createEServiceTemplate(req.body, ctx);
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
          ctx.logger,
          ctx.correlationId,
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
          ctx.logger,
          ctx.correlationId,
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
          ctx.logger,
          ctx.correlationId,
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
            ctx.logger,
            ctx.correlationId,
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
            ctx.logger,
            ctx.correlationId,
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
            ctx.logger,
            ctx.correlationId,
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
            ctx.logger,
            ctx.correlationId,
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
          await eserviceTemplateService.deleteEServiceTemplateEServiceRiskAnalysis(
            unsafeBrandId(eServiceTemplateId),
            unsafeBrandId(eServiceTemplateVersionId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            ctx.correlationId,
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
            ctx.logger,
            ctx.correlationId,
            `Error updating eservice template ${eServiceTemplateId} name`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/templateDescription/update",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { eServiceTemplateId } = req.params;

        try {
          await eserviceTemplateService.updateEServiceTemplateTemplateDescription(
            unsafeBrandId(eServiceTemplateId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            ctx.correlationId,
            `Error updating eservice template ${eServiceTemplateId} description`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/templates/:eServiceTemplateId/eserviceDescription/update",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { eServiceTemplateId } = req.params;

        try {
          await eserviceTemplateService.updateEServiceTemplateEServiceDescription(
            unsafeBrandId(eServiceTemplateId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            ctx.correlationId,
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
            ctx.logger,
            ctx.correlationId,
            `Error retrieving version ${eServiceTemplateVersionId} for eservice template ${eServiceTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get("/catalog/eservices/templates", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      const { q, creatorsIds, offset, limit } = req.query;

      try {
        const response =
          await eserviceTemplateService.getCatalogEServiceTemplates(
            q,
            creatorsIds,
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
          ctx.logger,
          ctx.correlationId,
          "Error retrieving Catalog eservice templates"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/producers/eservices/templates", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      const { q, offset, limit } = req.query;

      try {
        const response =
          await eserviceTemplateService.getProducerEServiceTemplates(
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
          ctx.logger,
          ctx.correlationId,
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
            ctx.logger,
            ctx.correlationId,
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
          await eserviceTemplateService.createEServiceTemplateEServiceRiskAnalysis(
            unsafeBrandId(eServiceTemplateId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            ctx.correlationId,
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
          await eserviceTemplateService.updateEServiceTemplateEServiceRiskAnalysis(
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
            ctx.logger,
            ctx.correlationId,
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
            ctx.logger,
            ctx.correlationId,
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
            ctx.logger,
            ctx.correlationId,
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
            ctx.logger,
            ctx.correlationId,
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
          ctx.logger,
          ctx.correlationId,
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
            emptyErrorMapper,
            ctx.logger,
            ctx.correlationId,
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
            ctx.logger,
            ctx.correlationId,
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
          return res.status(204);
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            ctx.correlationId,
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
          return res.status(204);
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx.logger,
            ctx.correlationId,
            `Error deleting eService template document ${req.params.documentId} for eService template ${req.params.eServiceTemplateId} and version ${req.params.eServiceTemplateVersionId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return eserviceTemplateRouter;
};

export default eserviceTemplateRouter;
