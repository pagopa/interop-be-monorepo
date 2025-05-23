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
import { emptyErrorMapper } from "pagopa-interop-models";
import { fromApiGatewayAppContext } from "../utilities/context.js";
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
import { ApiGatewayServices } from "../app.js";

const apiGatewayRouter = (
  services: ApiGatewayServices,
  ctx: ZodiosContext
): // eslint-disable-next-line sonarjs/cognitive-complexity
ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const { M2M_ROLE } = authRole;
  const apiGatewayRouter = ctx.router(apiGatewayApi.gatewayApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  apiGatewayRouter
    .get("/agreements", async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const agreements = await services.agreementService.getAgreements(
          ctx,
          req.query
        );

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

        const agreement = await services.agreementService.getAgreementById(
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

        const attributes =
          await services.agreementService.getAgreementAttributes(
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

        const purposes = await services.agreementService.getAgreementPurposes(
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

        const attribute =
          await services.attributeService.createCertifiedAttribute(
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

        const attribute = await services.attributeService.getAttribute(
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

        const client = await services.authorizationService.getClient(
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

        const eservices = await services.catalogService.getEservices(
          ctx,
          req.query
        );
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

        const eservice = await services.catalogService.getEservice(
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

          const descriptors =
            await services.catalogService.getEserviceDescriptors(
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

          const descriptor =
            await services.catalogService.getEserviceDescriptor(
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

        const events = await services.notifierEventsService.getEventsFromId(
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

        const events =
          await services.notifierEventsService.getAgreementsEventsFromId(
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

        const events =
          await services.notifierEventsService.getEservicesEventsFromId(
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

        const events = await services.notifierEventsService.getKeysEventsFromId(
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

        const events =
          await services.notifierEventsService.getProducerKeysEventsFromId(
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

        const jwk = await services.authorizationService.getJWK(
          ctx,
          req.params.kid
        );

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

        const purposes = await services.purposeService.getPurposes(
          ctx,
          req.query
        );

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

        const purpose = await services.purposeService.getPurpose(
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

          const agreement = await services.purposeService.getAgreementByPurpose(
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

        const organization = await services.tenantService.getOrganization(
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

          await services.tenantService.upsertTenant(ctx, {
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

          await services.tenantService.revokeTenantAttribute(ctx, {
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

          const eservices =
            await services.tenantService.getOrganizationEservices(ctx, {
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
