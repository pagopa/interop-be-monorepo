import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
  initDB,
} from "pagopa-interop-commons";
import { unsafeBrandId } from "pagopa-interop-models";
import { api } from "../model/generated/api.js";
import { toApiTenant } from "../model/domain/apiConverter.js";
import {
  makeApiProblem,
  tenantBySelfcareIdNotFound,
  tenantFromExternalIdNotFound,
  tenantNotFound,
} from "../model/domain/errors.js";
import {
  getTenantByExternalIdErrorMapper,
  getTenantByIdErrorMapper,
  getTenantBySelfcareIdErrorMapper,
  updateVerifiedAttributeExtensionDateErrorMapper,
  updateTenantVerifiedAttributeErrorMapper,
  selfcareUpsertTenantErrorMapper,
} from "../utilities/errorMappers.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { config } from "../utilities/config.js";
import { tenantServiceBuilder } from "../services/tenantService.js";

const readModelService = readModelServiceBuilder(config);
const tenantService = tenantServiceBuilder(
  initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  }),
  readModelService
);

const tenantsRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const tenantsRouter = ctx.router(api.api);
  const {
    ADMIN_ROLE,
    SECURITY_ROLE,
    API_ROLE,
    M2M_ROLE,
    INTERNAL_ROLE,
    SUPPORT_ROLE,
  } = userRoles;
  tenantsRouter
    .get(
      "/consumers",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        try {
          const { name, offset, limit } = req.query;
          const consumers = await readModelService.getConsumers({
            consumerName: name,
            authData: req.ctx.authData,
            offset,
            limit,
          });

          return res.status(200).json({
            results: consumers.results.map(toApiTenant),
            totalCount: consumers.totalCount,
          });
        } catch (error) {
          return res.status(500).send();
        }
      }
    )
    .get(
      "/producers",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        try {
          const { name, offset, limit } = req.query;
          const producers = await tenantService.getProducers({
            producerName: name,
            offset,
            limit,
          });

          return res.status(200).json({
            results: producers.results.map(toApiTenant),
            totalCount: producers.totalCount,
          });
        } catch (error) {
          return res.status(500).send();
        }
      }
    )
    .get(
      "/tenants",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        try {
          const { name, offset, limit } = req.query;
          const tenants = await tenantService.getTenantsByName({
            name,
            offset,
            limit,
          });

          return res.status(200).json({
            results: tenants.results.map(toApiTenant),
            totalCount: tenants.totalCount,
          });
        } catch (error) {
          return res.status(500).end();
        }
      }
    )

    .get(
      "/tenants/:id",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        M2M_ROLE,
        SECURITY_ROLE,
        INTERNAL_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        try {
          const tenant = await tenantService.getTenantById(
            unsafeBrandId(req.params.id)
          );

          if (tenant) {
            return res.status(200).json(toApiTenant(tenant.data)).end();
          } else {
            return res
              .status(404)
              .json(
                makeApiProblem(
                  tenantNotFound(unsafeBrandId(req.params.id)),
                  getTenantByIdErrorMapper
                )
              )
              .end();
          }
        } catch (error) {
          const errorRes = makeApiProblem(error, getTenantByIdErrorMapper);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/tenants/origin/:origin/code/:code",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        M2M_ROLE,
        SECURITY_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        try {
          const { origin, code } = req.params;

          const tenant = await tenantService.getTenantByExternalId({
            value: code,
            origin,
          });
          if (tenant) {
            return res.status(200).json(toApiTenant(tenant.data)).end();
          } else {
            return res
              .status(404)
              .json(
                makeApiProblem(
                  tenantFromExternalIdNotFound(origin, code),
                  getTenantByExternalIdErrorMapper
                )
              )
              .end();
          }
        } catch (error) {
          return res.status(500).end();
        }
      }
    )

    .get(
      "/tenants/selfcare/:selfcareId",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        M2M_ROLE,
        SECURITY_ROLE,
        INTERNAL_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        try {
          const tenant = await tenantService.getTenantBySelfcareId(
            req.params.selfcareId
          );

          if (tenant) {
            return res.status(200).json(toApiTenant(tenant.data)).end();
          } else {
            return res
              .status(404)
              .json(
                makeApiProblem(
                  tenantBySelfcareIdNotFound(req.params.selfcareId),
                  getTenantBySelfcareIdErrorMapper
                )
              )
              .end();
          }
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getTenantBySelfcareIdErrorMapper
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/internal/tenants",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/tenants/:id",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/internal/origin/:tOrigin/externalId/:tExternalId/attributes/origin/:aOrigin/externalId/:aExternalId",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/m2m/tenants",
      authorizationMiddleware([M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/selfcare/tenants",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        INTERNAL_ROLE,
      ]),
      async (req, res) => {
        try {
          const id = await tenantService.selfcareUpsertTenant({
            tenantSeed: req.body,
            authData: req.ctx.authData,
            correlationId: req.ctx.correlationId,
          });
          return res.status(200).json({ id }).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            selfcareUpsertTenantErrorMapper
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/tenants/:tenantId/attributes/verified",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/tenants/:tenantId/attributes/verified/:attributeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        try {
          const { tenantId, attributeId } = req.params;
          await tenantService.updateTenantVerifiedAttribute({
            authData: req.ctx.authData,
            tenantId: unsafeBrandId(tenantId),
            attributeId: unsafeBrandId(attributeId),
            updateVerifiedTenantAttributeSeed: req.body,
            correlationId: req.ctx.correlationId,
          });
          return res.status(200).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateTenantVerifiedAttributeErrorMapper
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/tenants/:tenantId/attributes/verified/:attributeId/verifier/:verifierId",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        try {
          const { tenantId, attributeId, verifierId } = req.params;
          await tenantService.updateVerifiedAttributeExtensionDate(
            unsafeBrandId(tenantId),
            unsafeBrandId(attributeId),
            verifierId,
            req.ctx.correlationId
          );
          return res.status(200).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateVerifiedAttributeExtensionDateErrorMapper
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/tenants/attributes/declared",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/internal/origin/:tOrigin/externalId/:tExternalId/attributes/origin/:aOrigin/externalId/:aExternalId",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/m2m/origin/:origin/externalId/:externalId/attributes/:code",
      authorizationMiddleware([M2M_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/tenants/:tenantId/attributes/verified/:attributeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/tenants/attributes/declared/:attributeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    );

  return tenantsRouter;
};
export default tenantsRouter;
