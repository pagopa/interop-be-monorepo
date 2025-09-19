import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { apiGatewayApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  ZodiosContext,
  authRole,
  validateAuthorization,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import {
  clientJWKKeyReadModelServiceBuilder,
  makeDrizzleConnection,
  producerJWKKeyReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { emptyErrorMapper } from "pagopa-interop-models";
import { fromApiGatewayAppContext } from "../utilities/context.js";
import { agreementServiceBuilder } from "../services/agreementService.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { makeApiProblem } from "../models/errors.js";
import {
  createCertifiedAttributeErrorMapper,
  getAgreementByPurposeErrorMapper,
  getAgreementErrorMapper,
  getAgreementsErrorMapper,
  getAttributeErrorMapper,
  getClientErrorMapper,
  getEserviceDescriptorErrorMapper,
  getEserviceErrorMapper,
  getJWKErrorMapper,
  getOrganizationErrorMapper,
  getOrganizationEservicesErrorMapper,
  getPurposeErrorMapper,
  revokeTenantAttributeErrorMapper,
  upsertTenantErrorMapper,
} from "../utilities/errorMappers.js";
import { purposeServiceBuilder } from "../services/purposeService.js";
import { catalogServiceBuilder } from "../services/catalogService.js";
import { tenantServiceBuilder } from "../services/tenantService.js";
import { notifierEventsServiceBuilder } from "../services/notifierEventsService.js";
import { attributeServiceBuilder } from "../services/attributeService.js";
import { authorizationServiceBuilder } from "../services/authorizationService.js";
import { config } from "../config/config.js";
import { readModelServiceBuilderSQL } from "../services/readModelServiceSQL.js";

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
    delegationProcessClient,
  }: PagoPAInteropBeClients
): // eslint-disable-next-line sonarjs/cognitive-complexity
ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const { M2M_ROLE } = authRole;
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
    agreementProcessClient,
    delegationProcessClient
  );

  const tenantService = tenantServiceBuilder(
    tenantProcessClient,
    attributeProcessClient,
    catalogProcessClient
  );

  const notifierEventsService =
    notifierEventsServiceBuilder(notifierEventsClient);

  const attributeService = attributeServiceBuilder(attributeProcessClient);

  const db = makeDrizzleConnection(config);
  const clientJWKKeyReadModelServiceSQL =
    clientJWKKeyReadModelServiceBuilder(db);
  const producerJWKKeyReadModelServiceSQL =
    producerJWKKeyReadModelServiceBuilder(db);

  const readModelServiceSQL = readModelServiceBuilderSQL(
    clientJWKKeyReadModelServiceSQL,
    producerJWKKeyReadModelServiceSQL
  );

  const authorizationService = authorizationServiceBuilder(
    authorizationProcessClient,
    readModelServiceSQL
  );

  apiGatewayRouter
    .get("/agreements", async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const agreements = await agreementService.getAgreements(ctx, req.query);

        return res.status(200).send(apiGatewayApi.Agreements.parse(agreements));
      } catch (error) {
        const errorRes = makeApiProblem(error, getAgreementsErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/agreements/:agreementId", async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const agreement = await agreementService.getAgreementById(
          ctx,
          req.params.agreementId
        );

        return res.status(200).send(apiGatewayApi.Agreement.parse(agreement));
      } catch (error) {
        const errorRes = makeApiProblem(error, getAgreementErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/agreements/:agreementId/attributes", async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const attributes = await agreementService.getAgreementAttributes(
          ctx,
          req.params.agreementId
        );

        return res.status(200).send(apiGatewayApi.Attributes.parse(attributes));
      } catch (error) {
        const errorRes = makeApiProblem(error, getAgreementErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/agreements/:agreementId/purposes", async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const purposes = await agreementService.getAgreementPurposes(
          ctx,
          req.params.agreementId
        );

        return res.status(200).send(apiGatewayApi.Purposes.parse(purposes));
      } catch (error) {
        const errorRes = makeApiProblem(error, getAgreementErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/attributes", async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const attribute = await attributeService.createCertifiedAttribute(
          ctx,
          req.body
        );

        return res.status(200).send(apiGatewayApi.Attribute.parse(attribute));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createCertifiedAttributeErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/attributes/:attributeId", async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const attribute = await attributeService.getAttribute(
          ctx,
          req.params.attributeId
        );

        return res.status(200).send(apiGatewayApi.Attribute.parse(attribute));
      } catch (error) {
        const errorRes = makeApiProblem(error, getAttributeErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/clients/:clientId", async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const client = await authorizationService.getClient(
          ctx,
          req.params.clientId
        );
        return res.status(200).send(apiGatewayApi.Client.parse(client));
      } catch (error) {
        const errorRes = makeApiProblem(error, getClientErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/eservices", async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const eservices = await catalogService.getEservices(ctx, req.query);
        return res
          .status(200)
          .send(apiGatewayApi.CatalogEServices.parse(eservices));
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/eservices/:eserviceId", async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const eservice = await catalogService.getEservice(
          ctx,
          req.params.eserviceId
        );
        return res.status(200).send(apiGatewayApi.EService.parse(eservice));
      } catch (error) {
        const errorRes = makeApiProblem(error, getEserviceErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/eservices/:eserviceId/descriptors",

      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ROLE]);

          const descriptors = await catalogService.getEserviceDescriptors(
            ctx,
            req.params.eserviceId
          );
          return res
            .status(200)
            .send(apiGatewayApi.EServiceDescriptors.parse(descriptors));
        } catch (error) {
          const errorRes = makeApiProblem(error, getEserviceErrorMapper, ctx);
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/eservices/:eserviceId/descriptors/:descriptorId",

      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ROLE]);

          const descriptor = await catalogService.getEserviceDescriptor(
            ctx,
            req.params.eserviceId,
            req.params.descriptorId
          );
          return res
            .status(200)
            .send(apiGatewayApi.EServiceDescriptor.parse(descriptor));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getEserviceDescriptorErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get("/events", async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const events = await notifierEventsService.getEventsFromId(
          ctx,
          req.query.lastEventId,
          req.query.limit
        );

        return res.status(200).send(apiGatewayApi.Events.parse(events));
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/events/agreements", async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const events = await notifierEventsService.getAgreementsEventsFromId(
          ctx,
          req.query.lastEventId,
          req.query.limit
        );

        return res.status(200).send(apiGatewayApi.Events.parse(events));
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/events/eservices", async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const events = await notifierEventsService.getEservicesEventsFromId(
          ctx,
          req.query.lastEventId,
          req.query.limit
        );

        return res.status(200).send(apiGatewayApi.Events.parse(events));
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/events/keys", async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const events = await notifierEventsService.getKeysEventsFromId(
          ctx,
          req.query.lastEventId,
          req.query.limit
        );

        return res.status(200).send(apiGatewayApi.Events.parse(events));
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/events/producerKeys", async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const events = await notifierEventsService.getProducerKeysEventsFromId(
          ctx,
          req.query.lastEventId,
          req.query.limit
        );

        return res.status(200).send(apiGatewayApi.Events.parse(events));
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/keys/:kid", async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const jwk = await authorizationService.getJWK(ctx, req.params.kid);

        return res.status(200).send(apiGatewayApi.JWK.parse(jwk));
      } catch (error) {
        const errorRes = makeApiProblem(error, getJWKErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/purposes", async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const purposes = await purposeService.getPurposes(ctx, req.query);

        return res.status(200).send(apiGatewayApi.Purposes.parse(purposes));
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/purposes/:purposeId", async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const purpose = await purposeService.getPurpose(
          ctx,
          req.params.purposeId
        );

        return res.status(200).send(apiGatewayApi.Purpose.parse(purpose));
      } catch (error) {
        const errorRes = makeApiProblem(error, getPurposeErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/purposes/:purposeId/agreement",

      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ROLE]);

          const agreement = await purposeService.getAgreementByPurpose(
            ctx,
            req.params.purposeId
          );
          return res.status(200).send(apiGatewayApi.Agreement.parse(agreement));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getAgreementByPurposeErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get("/organizations/:organizationId", async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const organization = await tenantService.getOrganization(
          ctx,
          req.params.organizationId
        );

        return res
          .status(200)
          .send(apiGatewayApi.Organization.parse(organization));
      } catch (error) {
        const errorRes = makeApiProblem(error, getOrganizationErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/organizations/origin/:origin/externalId/:externalId/attributes/:code",
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ROLE]);

          await tenantService.upsertTenant(ctx, {
            origin: req.params.origin,
            externalId: req.params.externalId,
            attributeCode: req.params.code,
          });

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, upsertTenantErrorMapper, ctx);
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/organizations/origin/:origin/externalId/:externalId/attributes/:code",
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ROLE]);

          await tenantService.revokeTenantAttribute(ctx, {
            origin: req.params.origin,
            externalId: req.params.externalId,
            attributeCode: req.params.code,
          });

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            revokeTenantAttributeErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/organizations/origin/:origin/externalId/:externalId/eservices",
      async (req, res) => {
        const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ROLE]);

          const eservices = await tenantService.getOrganizationEservices(ctx, {
            origin: req.params.origin,
            externalId: req.params.externalId,
            attributeOrigin: req.query.attributeOrigin,
            attributeCode: req.query.attributeCode,
          });

          return res.status(200).send(apiGatewayApi.EServices.parse(eservices));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getOrganizationEservicesErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return apiGatewayRouter;
};

export default apiGatewayRouter;
