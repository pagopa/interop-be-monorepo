import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import {
  AgreementId,
  AttributeId,
  TenantId,
  emptyErrorMapper,
  unsafeBrandId,
} from "pagopa-interop-models";
import { TenantService } from "../services/tenantService.js";
import { fromBffAppContext } from "../utilities/context.js";
import { makeApiProblem } from "../model/errors.js";

const tenantRouter = (
  ctx: ZodiosContext,
  tenantService: TenantService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const tenantRouter = ctx.router(bffApi.tenantsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  tenantRouter
    .get("/consumers", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await tenantService.getConsumers(
          req.query.q,
          req.query.offset,
          req.query.limit,
          ctx
        );

        return res.status(200).send(bffApi.CompactOrganizations.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving consumers for name ${req.query.q}, offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/producers", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await tenantService.getProducers(
          req.query.q,
          req.query.offset,
          req.query.limit,
          ctx
        );

        return res.status(200).send(bffApi.CompactOrganizations.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving producers for name ${req.query.q}, offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/purposeTemplatesCreators", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await tenantService.getPurposeTemplatesCreators(
          req.query.q,
          req.query.offset,
          req.query.limit,
          ctx
        );

        return res.status(200).send(bffApi.CompactOrganizations.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving Purpose Template creators for name ${req.query.q}, offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/tenants/attributes/certified", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await tenantService.getRequesterCertifiedAttributes(
          req.query.offset,
          req.query.limit,
          ctx
        );

        return res
          .status(200)
          .send(bffApi.RequesterCertifiedAttributes.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving tenant certified attributes offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/tenants/:tenantId/attributes/certified", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        const result = await tenantService.getCertifiedAttributes(
          tenantId,
          ctx
        );

        return res
          .status(200)
          .send(bffApi.CertifiedAttributesResponse.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving certified attributes for tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/tenants/:tenantId/attributes/certified", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        await tenantService.addCertifiedAttribute(tenantId, req.body, ctx);

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error adding certified attribute ${req.body.id} to tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/tenants/attributes/declared", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await tenantService.addDeclaredAttribute(req.body, ctx);

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error adding declared attribute ${req.body.id} to requester tenant`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/tenants/attributes/declared/:attributeId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const attributeId = unsafeBrandId<AttributeId>(req.params.attributeId);
        await tenantService.revokeDeclaredAttribute(attributeId, ctx);

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error revoking declared attribute ${req.params.attributeId} to requester tenant`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/tenants/:tenantId/attributes/declared", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        const result = await tenantService.getDeclaredAttributes(tenantId, ctx);

        return res
          .status(200)
          .send(bffApi.DeclaredAttributesResponse.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving declared attributes for tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/tenants/:tenantId/attributes/verified", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        const result = await tenantService.getVerifiedAttributes(tenantId, ctx);

        return res
          .status(200)
          .send(bffApi.VerifiedAttributesResponse.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving verified attributes for tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/tenants/:tenantId/attributes/verified", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        await tenantService.verifyVerifiedAttribute(tenantId, req.body, ctx);

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error verifying verified attribute ${req.body.id} to tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete(
      "/tenants/:tenantId/attributes/certified/:attributeId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
          const attributeId = unsafeBrandId<AttributeId>(
            req.params.attributeId
          );
          await tenantService.revokeCertifiedAttribute(
            tenantId,
            attributeId,
            ctx
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error revoking certified attribute ${req.params.attributeId} to tenant ${req.params.tenantId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/tenants/:tenantId/attributes/verified/:attributeId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
          const attributeId = unsafeBrandId<AttributeId>(
            req.params.attributeId
          );
          await tenantService.updateVerifiedAttribute(
            tenantId,
            attributeId,
            req.body,
            ctx
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating expirationDate for verified attribute ${req.params.attributeId} to tenant ${req.params.tenantId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/tenants/:tenantId/attributes/verified/:attributeId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
          const attributeId = unsafeBrandId<AttributeId>(
            req.params.attributeId
          );
          const agreementId = unsafeBrandId<AgreementId>(req.body.agreementId);
          await tenantService.revokeVerifiedAttribute(
            tenantId,
            attributeId,
            agreementId,
            ctx
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error revoking verified attribute ${req.params.attributeId} to tenant ${req.params.tenantId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get("/tenants/:tenantId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        const result = await tenantService.getTenant(tenantId, ctx);
        return res.status(200).send(bffApi.Tenant.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving tenant with tenantId ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/tenants/:tenantId/mails", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        await tenantService.addTenantMail(tenantId, req.body, ctx);
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error adding mail to tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/tenants/:tenantId/mails/:mailId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const tenantId = unsafeBrandId<TenantId>(req.params.tenantId);
        await tenantService.deleteTenantMail(tenantId, req.params.mailId, ctx);
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error deleting mail ${req.params.mailId} from tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/tenants", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await tenantService.getTenants(
          req.query.name,
          req.query.features,
          req.query.limit,
          ctx
        );
        return res.status(200).send(bffApi.Tenants.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving tenants`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/tenants/delegatedFeatures/update", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      const tenantId = ctx.authData.organizationId;

      try {
        await tenantService.updateTenantDelegatedFeatures(
          tenantId,
          req.body,
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error while updating delegated producer and consumer feature to ${tenantId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return tenantRouter;
};

export default tenantRouter;
