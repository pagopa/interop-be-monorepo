import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  validateAuthorization,
  authRole,
} from "pagopa-interop-commons";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { TenantService } from "../services/tenantService.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";
import { getTenantsErrorMapper } from "../utils/errorMappers.js";

const tenantRouter = (
  ctx: ZodiosContext,
  tenantService: TenantService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const { M2M_ROLE, M2M_ADMIN_ROLE } = authRole;
  const tenantRouter = ctx.router(m2mGatewayApi.tenantsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  tenantRouter
    .get("/tenants", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);
        const tenants = await tenantService.getTenants(req.query, ctx);

        return res.status(200).send(m2mGatewayApi.Tenants.parse(tenants));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getTenantsErrorMapper,
          ctx,
          "Error retrieving tenants"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/tenants/:tenantId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);
        const tenant = await tenantService.getTenant(
          unsafeBrandId(req.params.tenantId),
          ctx
        );

        return res.status(200).send(m2mGatewayApi.Tenant.parse(tenant));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving tenant with id ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/tenants/:tenantId/declaredAttributes", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);
        const declaredAttributes = await tenantService.getDeclaredAttributes(
          unsafeBrandId(req.params.tenantId),
          req.query,
          ctx
        );

        return res
          .status(200)
          .send(
            m2mGatewayApi.TenantDeclaredAttributes.parse(declaredAttributes)
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving tenant ${req.params.tenantId} declared attributes`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/tenants/:tenantId/certifiedAttributes", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);
        const certifiedAttributes = await tenantService.getCertifiedAttributes(
          unsafeBrandId(req.params.tenantId),
          req.query,
          ctx
        );

        return res
          .status(200)
          .send(
            m2mGatewayApi.TenantCertifiedAttributes.parse(certifiedAttributes)
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving tenant ${req.params.tenantId} certified attributes`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/tenants/:tenantId/certifiedAttributes", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);
        const certifiedAttribute = await tenantService.assignCertifiedAttribute(
          unsafeBrandId(req.params.tenantId),
          req.body,
          ctx
        );

        return res
          .status(200)
          .send(
            m2mGatewayApi.TenantCertifiedAttribute.parse(certifiedAttribute)
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error assigning certified attribute to tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete(
      "/tenants/:tenantId/certifiedAttributes/:attributeId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);
          const certifiedAttribute =
            await tenantService.revokeCertifiedAttribute(
              unsafeBrandId(req.params.tenantId),
              unsafeBrandId(req.params.attributeId),
              ctx
            );

          return res
            .status(200)
            .send(
              m2mGatewayApi.TenantCertifiedAttribute.parse(certifiedAttribute)
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error revoking certified attribute ${req.params.attributeId} from tenant ${req.params.tenantId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get("/tenants/:tenantId/verifiedAttributes", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);
        const verifiedAttributes = await tenantService.getVerifiedAttributes(
          unsafeBrandId(req.params.tenantId),
          req.query,
          ctx
        );

        return res
          .status(200)
          .send(
            m2mGatewayApi.TenantVerifiedAttributes.parse(verifiedAttributes)
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving tenant ${req.params.tenantId} verified attributes`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return tenantRouter;
};

export default tenantRouter;
