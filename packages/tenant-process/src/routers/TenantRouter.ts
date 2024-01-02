import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
} from "pagopa-interop-commons";
import { api } from "../model/generated/api.js";
import { toApiTenant } from "../model/domain/apiConverter.js";
import { readModelService } from "../services/readModelService.js";
import {
  makeApiProblem,
  tenantBySelfcateIdNotFound,
  tenantNotFound,
} from "../model/domain/errors.js";
import {
  getTenantByExternalIdErrorMapper,
  getTenantByIdErrorMapper,
  getTenantBySelfcareIdErrorMapper,
} from "../utilities/errorMappers.js";

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
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/producers",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        SUPPORT_ROLE,
      ]),
      async (_req, res) => res.status(501).send()
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
          const tenants = await readModelService.getTenants({
            name,
            offset,
            limit,
          });

          return res.status(200).json({
            results: tenants.results.map(toApiTenant),
            totalCount: tenants.totalCount,
          });
        } catch (error) {
          const errorRes = makeApiProblem(error);
          return res.status(errorRes.status).json(errorRes).end();
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
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        try {
          const tenant = await readModelService.getTenantById(req.params.id);

          if (tenant) {
            return res.status(200).json(toApiTenant(tenant.data)).end();
          } else {
            return res
              .status(404)
              .json(
                makeApiProblem(
                  tenantNotFound(req.params.id),
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

          const tenant = await readModelService.getTenantByExternalId({
            origin,
            code,
          });
          if (tenant) {
            return res.status(200).json(toApiTenant(tenant.data)).end();
          } else {
            return res
              .status(404)
              .json(
                makeApiProblem(
                  tenantNotFound(`${origin}/${code}`),
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
          const tenant = await readModelService.getTenantBySelfcareId(
            req.params.selfcareId
          );

          if (tenant) {
            return res.status(200).json(toApiTenant(tenant.data)).end();
          } else {
            return res
              .status(404)
              .json(
                makeApiProblem(
                  tenantBySelfcateIdNotFound(req.params.selfcareId),
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
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/tenants/:tenantId/attributes/verified",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/tenants/:tenantId/attributes/verified/:attributeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/tenants/:tenantId/attributes/verified/:attributeId/verifier/:verifierId",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (_req, res) => res.status(501).send()
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
