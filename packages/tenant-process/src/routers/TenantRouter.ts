import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
  initDB,
  zodiosValidationErrorToApiProblem,
  fromAppContext,
  ReadModelRepository,
} from "pagopa-interop-commons";
import { unsafeBrandId } from "pagopa-interop-models";
import { api } from "../model/generated/api.js";
import { toApiTenant } from "../model/domain/apiConverter.js";
import {
  tenantBySelfcareIdNotFound,
  tenantFromExternalIdNotFound,
  tenantNotFound,
  makeApiProblem,
} from "../model/domain/errors.js";
import {
  getTenantByExternalIdErrorMapper,
  getTenantByIdErrorMapper,
  getTenantBySelfcareIdErrorMapper,
  updateVerifiedAttributeExtensionDateErrorMapper,
  updateTenantVerifiedAttributeErrorMapper,
  selfcareUpsertTenantErrorMapper,
  addCertifiedAttributeErrorMapper,
  getCertifiedAttributesErrorMapper,
  addDeclaredAttributeErrorMapper,
} from "../utilities/errorMappers.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { config } from "../utilities/config.js";
import { tenantServiceBuilder } from "../services/tenantService.js";
import { ApiCertifiedAttribute } from "../model/domain/models.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);
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
  const tenantsRouter = ctx.router(api.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
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
        const { logger } = fromAppContext(req.ctx);

        try {
          const { name, offset, limit } = req.query;
          const consumers = await tenantService.getConsumers(
            {
              consumerName: name,
              producerId: req.ctx.authData.organizationId,
              offset,
              limit,
            },
            logger
          );

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
        const { logger } = fromAppContext(req.ctx);

        try {
          const { name, offset, limit } = req.query;
          const producers = await tenantService.getProducers(
            {
              producerName: name,
              offset,
              limit,
            },
            logger
          );

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
        const { logger } = fromAppContext(req.ctx);

        try {
          const { name, offset, limit } = req.query;
          const tenants = await tenantService.getTenantsByName(
            {
              name,
              offset,
              limit,
            },
            logger
          );

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
        const ctx = fromAppContext(req.ctx);

        try {
          const tenant = await tenantService.getTenantById(
            unsafeBrandId(req.params.id),
            ctx.logger
          );

          if (tenant) {
            return res.status(200).json(toApiTenant(tenant.data)).end();
          } else {
            return res
              .status(404)
              .json(
                makeApiProblem(
                  tenantNotFound(unsafeBrandId(req.params.id)),
                  getTenantByIdErrorMapper,
                  ctx.logger
                )
              )
              .end();
          }
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getTenantByIdErrorMapper,
            ctx.logger
          );
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
        const ctx = fromAppContext(req.ctx);

        try {
          const { origin, code } = req.params;

          const tenant = await tenantService.getTenantByExternalId(
            {
              value: code,
              origin,
            },
            ctx.logger
          );
          if (tenant) {
            return res.status(200).json(toApiTenant(tenant.data)).end();
          } else {
            return res
              .status(404)
              .json(
                makeApiProblem(
                  tenantFromExternalIdNotFound(origin, code),
                  getTenantByExternalIdErrorMapper,
                  ctx.logger
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
        const ctx = fromAppContext(req.ctx);

        try {
          const tenant = await tenantService.getTenantBySelfcareId(
            req.params.selfcareId,
            ctx.logger
          );

          if (tenant) {
            return res.status(200).json(toApiTenant(tenant.data)).end();
          } else {
            return res
              .status(404)
              .json(
                makeApiProblem(
                  tenantBySelfcareIdNotFound(req.params.selfcareId),
                  getTenantBySelfcareIdErrorMapper,
                  ctx.logger
                )
              )
              .end();
          }
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getTenantBySelfcareIdErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/tenants/attributes/certified",
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
          const { offset, limit } = req.query;
          const { results, totalCount } =
            await tenantService.getCertifiedAttributes({
              organizationId: req.ctx.authData.organizationId,
              offset,
              limit,
            });

          return res.status(200).json({
            results: results satisfies ApiCertifiedAttribute[],
            totalCount,
          });
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getCertifiedAttributesErrorMapper,
            ctx.logger
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
        const ctx = fromAppContext(req.ctx);

        try {
          const id = await tenantService.selfcareUpsertTenant(req.body, ctx);
          return res.status(200).json({ id }).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            selfcareUpsertTenantErrorMapper,
            ctx.logger
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
        const ctx = fromAppContext(req.ctx);

        try {
          const { tenantId, attributeId } = req.params;
          const tenant = await tenantService.updateTenantVerifiedAttribute(
            {
              verifierId: req.ctx.authData.organizationId,
              tenantId: unsafeBrandId(tenantId),
              attributeId: unsafeBrandId(attributeId),
              updateVerifiedTenantAttributeSeed: req.body,
            },
            ctx
          );
          return res.status(200).json(toApiTenant(tenant)).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateTenantVerifiedAttributeErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/tenants/:tenantId/attributes/verified/:attributeId/verifier/:verifierId",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const { tenantId, attributeId, verifierId } = req.params;
          const tenant =
            await tenantService.updateVerifiedAttributeExtensionDate(
              unsafeBrandId(tenantId),
              unsafeBrandId(attributeId),
              verifierId,
              ctx
            );
          return res.status(200).json(toApiTenant(tenant)).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateVerifiedAttributeExtensionDateErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/tenants/:tenantId/attributes/certified",
      authorizationMiddleware([ADMIN_ROLE, M2M_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { tenantId } = req.params;
          const tenant = await tenantService.addCertifiedAttribute(
            unsafeBrandId(tenantId),
            ctx.logger,
            {
              tenantAttributeSeed: req.body,
              organizationId: req.ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
            }
          );
          return res.status(200).json(toApiTenant(tenant)).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            addCertifiedAttributeErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/tenants/attributes/declared",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const tenant = await tenantService.addDeclaredAttribute(
            {
              tenantAttributeSeed: req.body,
              organizationId: req.ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
            },
            ctx.logger
          );
          return res.status(200).json(toApiTenant(tenant)).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            addDeclaredAttributeErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
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
