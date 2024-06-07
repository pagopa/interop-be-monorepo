import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
  authorizationMiddleware,
  userRoles,
} from "pagopa-interop-commons";
import { api } from "../model/generated/api.js";
import { createApiClient as createTenantProcessClient } from "../model/tenant-process/generated/api.js";

const tenantProcessService = createTenantProcessClient("url");

tenantProcessService.getTenant("tenantId");

const catalogRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const catalogRouter = ctx.router(api.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  const {
    ADMIN_ROLE,
    // SECURITY_ROLE,
    // API_ROLE,
    // M2M_ROLE,
    // INTERNAL_ROLE,
    // SUPPORT_ROLE,
  } = userRoles;

  catalogRouter.get(
    "/catalog",
    authorizationMiddleware([ADMIN_ROLE]),
    async (_req, res) => {
      //   const {
      //     offset,
      //     limit,
      //     producersIds,
      //     states,
      //     attributesIds,
      //     agreementStates,
      //     q: name,
      //     mode,
      //   } = req.query;

      // const eservices = await catalogProcessService.getEServices({
      //   headers: {
      //     "X-Correlation-Id": req.ctx.correlationId, // TODO get correlation id
      //   },
      //   queries: {
      //     offset,
      //     limit,
      //     producersIds: producersIds.join(","),
      //     states: states.join(","),
      //     attributesIds: attributesIds.join(","),
      //     agreementStates: agreementStates.join(","),
      //     name,
      //     mode,
      //   },
      // });

      // const enhanceCatalogEService = async (eservice: EService) => {
      //   const producerTenant = await tenantProcessService.getTenant(
      //     eservice.producerId
      //   );
      // };

      // return res.send(eservices.map(enhanceCatalogEService));
      return res.status(501).send();
    }
  );
  // .get(
  //   "/producers/eservices",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .get(
  //   "/producers/eservices/:eserviceId",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .get(
  //   "/producers/eservices/:eserviceId/descriptors/:descriptorId",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .get(
  //   "/catalog/eservices/:eserviceId/descriptor/:descriptorId",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .post(
  //   "/eservices",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .get(
  //   "/eservices/:eServiceId/consumers",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .delete(
  //   "/eservices/:eServiceId/descriptors/:descriptorId",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .put(
  //   "/eservices/:eServiceId/descriptors/:descriptorId",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .post(
  //   "/eservices/:eServiceId/descriptors",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .post(
  //   "/eservices/:eServiceId/descriptors/:descriptorId/activate",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .post(
  //   "/eservices/:eServiceId/descriptors/:descriptorId/update",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .post(
  //   "/eservices/:eServiceId/descriptors/:descriptorId/publish",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .post(
  //   "/eservices/:eServiceId/descriptors/:descriptorId/suspend",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .post(
  //   "/eservices/:eServiceId/descriptors/:descriptorId/documents",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .delete(
  //   "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .get(
  //   "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .post(
  //   "/eservices/:eServiceId/descriptors/:descriptorId/clone",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .post(
  //   "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .delete(
  //   "/eservices/:eServiceId",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .put(
  //   "/eservices/:eServiceId",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .post(
  //   "/eservices/:eServiceId/riskAnalysis",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .get(
  //   "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .post(
  //   "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // )
  // .delete(
  //   "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
  //   authorizationMiddleware([ADMIN_ROLE]),
  //   async (_req, res) => res.status(501).send()
  // );

  return catalogRouter;
};

export default catalogRouter;
