import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { apiGatewayApi } from "pagopa-interop-api-clients";
import {
  authorizationMiddleware,
  ExpressContext,
  ReadModelRepository,
  userRoles,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { fromApiGatewayAppContext } from "../utilities/context.js";
import { agreementServiceBuilder } from "../services/agreementService.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { makeApiProblem } from "../models/errors.js";
import {
  emptyErrorMapper,
  getAgreementByPurposeErrorMapper,
  getAgreementErrorMapper,
  getAgreementsErrorMapper,
  getClientErrorMapper,
  getEserviceDescriptorErrorMapper,
  getEserviceErrorMapper,
  getJWKErrorMapper,
  getPurposeErrorMapper,
} from "../utilities/errorMappers.js";
import { purposeServiceBuilder } from "../services/purposeService.js";
import { catalogServiceBuilder } from "../services/catalogService.js";
import { tenantServiceBuilder } from "../services/tenantService.js";
import { notifierEventsServiceBuilder } from "../services/notifierEventsService.js";
import { attributeServiceBuilder } from "../services/attributeService.js";
import { authorizationServiceBuilder } from "../services/authorizationService.js";
import { config } from "../config/config.js";
import { readModelServiceBuilder } from "../services/readModelService.js";

const apiGatewayRouter = (
  ctx: ZodiosContext,
  {
    agreementProcessClient,
    tenantProcessClient,
    purposeProcessClient,
    catalogProcessClient,
    attributeProcessClient,
    notifierEventsClient,
    authorizationProcessClient,
  }: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const { M2M_ROLE } = userRoles;
  const apiGatewayRouter = ctx.router(apiGatewayApi.gatewayApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const catalogService = catalogServiceBuilder(
    catalogProcessClient,
    tenantProcessClient,
    attributeProcessClient
  );

  const agreementService = agreementServiceBuilder(
    agreementProcessClient,
    tenantProcessClient,
    purposeProcessClient
  );

  const purposeService = purposeServiceBuilder(
    purposeProcessClient,
    catalogProcessClient,
    agreementProcessClient
  );

  const tenantService = tenantServiceBuilder(
    tenantProcessClient,
    attributeProcessClient,
    catalogProcessClient
  );

  const notifierEventsService =
    notifierEventsServiceBuilder(notifierEventsClient);

  const attributeService = attributeServiceBuilder(attributeProcessClient);

  const readModelService = readModelServiceBuilder(
    ReadModelRepository.init(config)
  );

  const authorizationService = authorizationServiceBuilder(
    authorizationProcessClient,
    purposeProcessClient,
    catalogProcessClient,
    readModelService
  );

  apiGatewayRouter
    .get(
      "/agreements",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          const agreements = await agreementService.getAgreements(
            ctx,
            req.query
          );

          return res.status(200).json(agreements).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getAgreementsErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/agreements/:agreementId",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          const agreement = await agreementService.getAgreementById(
            ctx,
            req.params.agreementId
          );

          return res.status(200).json(agreement).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getAgreementErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/agreements/:agreementId/attributes",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          const attributes = await agreementService.getAgreementAttributes(
            ctx,
            req.params.agreementId
          );

          return res.status(200).json(attributes).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getAgreementErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/agreements/:agreementId/purposes",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          const purposes = await agreementService.getAgreementPurposes(
            ctx,
            req.params.agreementId
          );

          return res.status(200).json(purposes).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getAgreementErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/attributes",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          const attribute = await attributeService.createCertifiedAttribute(
            ctx,
            req.body
          );

          return res.status(200).json(attribute).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/attributes/:attributeId",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          const attribute = await attributeService.getAttribute(
            ctx,
            req.params.attributeId
          );

          return res.status(200).json(attribute).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/clients/:clientId",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          const client = await authorizationService.getClient(
            ctx,
            req.params.clientId
          );
          return res.status(200).json(client).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getClientErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/eservices",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);
        try {
          const eservices = await catalogService.getEservices(ctx, req.query);
          return res.status(200).json(eservices).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/eservices/:eserviceId",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);
        try {
          const eservice = await catalogService.getEservice(
            ctx,
            req.params.eserviceId
          );
          return res.status(200).json(eservice).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getEserviceErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/eservices/:eserviceId/descriptors",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);
        try {
          const descriptors = await catalogService.getEserviceDescriptors(
            ctx,
            req.params.eserviceId
          );
          return res.status(200).json(descriptors).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/eservices/:eserviceId/descriptors/:descriptorId",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);
        try {
          const descriptor = await catalogService.getEserviceDescriptor(
            ctx,
            req.params.eserviceId,
            req.params.descriptorId
          );
          return res.status(200).json(descriptor).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getEserviceDescriptorErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get("/events", authorizationMiddleware([M2M_ROLE]), async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        const events = await notifierEventsService.getEventsFromId(
          ctx,
          req.query.lastEventId,
          req.query.limit
        );

        return res.status(200).json(events).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get(
      "/events/agreements",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          const events = await notifierEventsService.getAgreementsEventsFromId(
            ctx,
            req.query.lastEventId,
            req.query.limit
          );

          return res.status(200).json(events).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/events/eservices",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          const events = await notifierEventsService.getEservicesEventsFromId(
            ctx,
            req.query.lastEventId,
            req.query.limit
          );

          return res.status(200).json(events).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/events/keys",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          const events = await notifierEventsService.getKeysEventsFromId(
            ctx,
            req.query.lastEventId,
            req.query.limit
          );

          return res.status(200).json(events).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/events/producerKeys",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          const events =
            await notifierEventsService.getProducerKeysEventsFromId(
              ctx,
              req.query.lastEventId,
              req.query.limit
            );

          return res.status(200).json(events).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/keys/:kid",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          const jwk = await authorizationService.getJWK(ctx, req.params.kid);

          return res.status(200).json(jwk).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, getJWKErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get("/purposes", authorizationMiddleware([M2M_ROLE]), async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        const purposes = await purposeService.getPurposes(ctx, req.query);

        return res.status(200).json(purposes).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get(
      "/purposes/:purposeId",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);
        try {
          const purpose = await purposeService.getPurpose(
            ctx,
            req.params.purposeId
          );

          return res.status(200).json(purpose).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getPurposeErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/purposes/:purposeId/agreement",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);
        try {
          const agreement = await purposeService.getAgreementByPurpose(
            ctx,
            req.params.purposeId
          );
          return res.status(200).json(agreement).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getAgreementByPurposeErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/organizations/:organizationId",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          const organization = await tenantService.getOrganization(
            ctx,
            req.params.organizationId
          );

          return res.status(200).json(organization).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/organizations/origin/:origin/externalId/:externalId/attributes/:code",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          await tenantService.upsertTenant(ctx, {
            origin: req.params.origin,
            externalId: req.params.externalId,
            attributeCode: req.params.code,
          });

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete(
      "/organizations/origin/:origin/externalId/:externalId/attributes/:code",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);
        try {
          await tenantService.revokeTenantAttribute(ctx, {
            origin: req.params.origin,
            externalId: req.params.externalId,
            attributeCode: req.params.code,
          });

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/organizations/origin/:origin/externalId/:externalId/eservices",
      authorizationMiddleware([M2M_ROLE]),
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          const eservices = await tenantService.getOrganizationEservices(ctx, {
            origin: req.params.origin,
            externalId: req.params.externalId,
            attributeOrigin: req.query.attributeOrigin,
            attributeCode: req.query.attributeCode,
          });

          return res.status(200).json(eservices).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    );

  return apiGatewayRouter;
};

export default apiGatewayRouter;
