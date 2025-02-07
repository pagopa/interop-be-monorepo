import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import {
  ExpressContext,
  FileManager,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { eserviceTemplateServiceBuilder } from "../services/eserviceTemplateService.js";
import { fromBffAppContext } from "../utilities/context.js";
import { emptyErrorMapper, makeApiProblem } from "../model/errors.js";
import { bffGetEServiceTemplateErrorMapper } from "../utilities/errorMappers.js";

const eserviceTemplateRouter = (
  ctx: ZodiosContext,
  {
    eserviceTemplateProcessClient,
    tenantProcessClient,
    attributeProcessClient,
  }: PagoPAInteropBeClients,
  fileManager: FileManager
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const eserviceTemplateRouter = ctx.router(bffApi.eserviceTemplatesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const eserviceTemplateService = eserviceTemplateServiceBuilder(
    eserviceTemplateProcessClient,
    tenantProcessClient,
    attributeProcessClient,
    fileManager
  );

  eserviceTemplateRouter
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
      "/eservices/templates/:eServiceTemplateId/audienceDescription/update",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { eServiceTemplateId } = req.params;

        try {
          await eserviceTemplateService.updateEServiceTemplateAudienceDescription(
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
            `Error updating eservice template ${eServiceTemplateId} audience description`
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
    );

  return eserviceTemplateRouter;
};

export default eserviceTemplateRouter;
