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
  getPurposeTemplateErrorMapper,
  getPurposeTemplateEServiceDescriptorsErrorMapper,
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
          getPurposeTemplateErrorMapper,
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
          getPurposeTemplateErrorMapper,
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
    .get("/purposeTemplates/:purposeTemplateId/eservices", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const { producerIds, eserviceIds, offset, limit } = req.query;
        const response =
          await purposeTemplateService.getPurposeTemplateEServiceDescriptors({
            purposeTemplateId: req.params.purposeTemplateId,
            producerIds,
            eserviceIds,
            offset,
            limit,
            ctx,
          });
        return res
          .status(200)
          .send(bffApi.EServiceDescriptorsPurposeTemplate.parse(response));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getPurposeTemplateEServiceDescriptorsErrorMapper,
          ctx,
          "Error retrieving purpose template e-services"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return purposeTemplateRouter;
};

export default purposeTemplateRouter;
