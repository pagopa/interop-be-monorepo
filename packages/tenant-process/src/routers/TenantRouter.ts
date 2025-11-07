import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
  fromAppContext,
  authRole,
  validateAuthorization,
  setMetadataVersionHeader,
} from "pagopa-interop-commons";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { tenantApi } from "pagopa-interop-api-clients";
import {
  apiTenantFeatureTypeToTenantFeatureType,
  toApiTenant,
  toApiTenantRevoker,
  toApiTenantVerifier,
} from "../model/domain/apiConverter.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  getTenantByExternalIdErrorMapper,
  getTenantByIdErrorMapper,
  getTenantBySelfcareIdErrorMapper,
  updateVerifiedAttributeExtensionDateErrorMapper,
  updateTenantVerifiedAttributeErrorMapper,
  selfcareUpsertTenantErrorMapper,
  addCertifiedAttributeErrorMapper,
  getCertifiedAttributesErrorMapper,
  revokeCertifiedAttributeErrorMapper,
  maintenanceTenantDeletedErrorMapper,
  maintenanceTenantPromotedToCertifierErrorMapper,
  deleteTenantMailErrorMapper,
  addTenantMailErrorMapper,
  addDeclaredAttributeErrorMapper,
  verifyVerifiedAttributeErrorMapper,
  revokeVerifiedAttributeErrorMapper,
  internalAddCertifiedAttributeErrorMapper,
  internalRevokeCertifiedAttributeErrorMapper,
  revokeDeclaredAttributeErrorMapper,
  internalUpsertTenantErrorMapper,
  m2mRevokeCertifiedAttributeErrorMapper,
  m2mUpsertTenantErrorMapper,
  maintenanceTenantUpdatedErrorMapper,
  updateTenantDelegatedFeaturesErrorMapper,
  getTenantVerifiedAttributeVerifiersErrorMapper,
  getTenantVerifiedAttributeRevokersErrorMapper,
} from "../utilities/errorMappers.js";
import { TenantService } from "../services/tenantService.js";

const tenantsRouter = (
  ctx: ZodiosContext,
  tenantService: TenantService
): Array<ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext>> => {
  const {
    ADMIN_ROLE,
    SECURITY_ROLE,
    API_ROLE,
    M2M_ROLE,
    M2M_ADMIN_ROLE,
    INTERNAL_ROLE,
    SUPPORT_ROLE,
    MAINTENANCE_ROLE,
  } = authRole;
  const tenantsRouter = ctx.router(tenantApi.tenantApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  tenantsRouter
    .get("/consumers", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          SUPPORT_ROLE,
        ]);

        const { name, offset, limit } = req.query;
        const consumers = await tenantService.getConsumers(
          {
            consumerName: name,
            offset,
            limit,
          },
          ctx
        );

        return res.status(200).send(
          tenantApi.Tenants.parse({
            results: consumers.results.map(toApiTenant),
            totalCount: consumers.totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/producers", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          SUPPORT_ROLE,
        ]);

        const { name, offset, limit } = req.query;
        const producers = await tenantService.getProducers(
          {
            producerName: name,
            offset,
            limit,
          },
          ctx
        );

        return res.status(200).send(
          tenantApi.Tenants.parse({
            results: producers.results.map(toApiTenant),
            totalCount: producers.totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/purposeTemplatesCreators", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          SUPPORT_ROLE,
        ]);

        const { name, offset, limit } = req.query;
        const producers = await tenantService.getPurposeTemplatesCreators(
          {
            creatorName: name,
            offset,
            limit,
          },
          ctx
        );

        return res.status(200).send(
          tenantApi.Tenants.parse({
            results: producers.results.map(toApiTenant),
            totalCount: producers.totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/tenants", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          SUPPORT_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
        ]);

        const {
          name,
          features,
          externalIdOrigin,
          externalIdValue,
          offset,
          limit,
        } = req.query;
        const tenants = await tenantService.getTenants(
          {
            name,
            features: features.map(apiTenantFeatureTypeToTenantFeatureType),
            externalIdOrigin,
            externalIdValue,
            offset,
            limit,
          },
          ctx
        );

        return res.status(200).send(
          tenantApi.Tenants.parse({
            results: tenants.results.map(toApiTenant),
            totalCount: tenants.totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/tenants/:id", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
          SECURITY_ROLE,
          SUPPORT_ROLE,
          INTERNAL_ROLE,
        ]);

        const { data: tenant, metadata } = await tenantService.getTenantById(
          unsafeBrandId(req.params.id),
          ctx
        );

        setMetadataVersionHeader(res, metadata);

        return res
          .status(200)
          .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
      } catch (error) {
        const errorRes = makeApiProblem(error, getTenantByIdErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/tenants/origin/:origin/code/:code", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          M2M_ROLE,
          SECURITY_ROLE,
          SUPPORT_ROLE,
        ]);

        const { origin, code } = req.params;

        const tenant = await tenantService.getTenantByExternalId(
          {
            value: code,
            origin,
          },
          ctx
        );
        return res
          .status(200)
          .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getTenantByExternalIdErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/tenants/attributes/certified", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ROLE, SUPPORT_ROLE]);

        const { offset, limit } = req.query;
        const { results, totalCount } =
          await tenantService.getCertifiedAttributes(
            {
              offset,
              limit,
            },
            ctx
          );

        return res.status(200).send(
          tenantApi.CertifiedAttributes.parse({
            results: results satisfies tenantApi.CertifiedAttribute[],
            totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getCertifiedAttributesErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/tenants/:tenantId/attributes/verified/:attributeId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE]);

          const { tenantId, attributeId } = req.params;
          const tenant = await tenantService.updateTenantVerifiedAttribute(
            {
              tenantId: unsafeBrandId(tenantId),
              attributeId: unsafeBrandId(attributeId),
              updateVerifiedTenantAttributeSeed: req.body,
            },
            ctx
          );
          return res
            .status(200)
            .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateTenantVerifiedAttributeErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/tenants/:tenantId/attributes/verified/:attributeId/verifier/:verifierId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);

          const { tenantId, attributeId, verifierId } = req.params;
          const tenant =
            await tenantService.updateVerifiedAttributeExtensionDate(
              unsafeBrandId(tenantId),
              unsafeBrandId(attributeId),
              verifierId,
              ctx
            );
          return res
            .status(200)
            .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateVerifiedAttributeExtensionDateErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/maintenance/tenants/:tenantId/certifier", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [MAINTENANCE_ROLE]);

        const tenant = await tenantService.addCertifierId(
          {
            tenantId: unsafeBrandId(req.params.tenantId),
            certifierId: req.body.certifierId,
          },
          ctx
        );
        return res
          .status(200)
          .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          maintenanceTenantPromotedToCertifierErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/tenants/:tenantId/mails", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        await tenantService.addTenantMail(
          {
            tenantId: unsafeBrandId(req.params.tenantId),
            mailSeed: req.body,
          },
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, addTenantMailErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/maintenance/tenants/:tenantId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [MAINTENANCE_ROLE]);

        await tenantService.maintenanceTenantDelete(
          {
            tenantId: unsafeBrandId(req.params.tenantId),
            version: req.body.currentVersion,
          },
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          maintenanceTenantDeletedErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/maintenance/tenants/:tenantId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [MAINTENANCE_ROLE]);

        await tenantService.maintenanceTenantUpdate(
          {
            tenantId: unsafeBrandId(req.params.tenantId),
            version: req.body.currentVersion,
            tenantUpdate: req.body.tenant,
          },
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          maintenanceTenantUpdatedErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/tenants/:tenantId/mails/:mailId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const { tenantId, mailId } = req.params;
        await tenantService.deleteTenantMailById(
          {
            tenantId: unsafeBrandId(tenantId),
            mailId,
          },
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          deleteTenantMailErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/tenants/delegatedFeatures/update", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        await tenantService.updateTenantDelegatedFeatures(
          {
            tenantFeatures: req.body,
          },
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          updateTenantDelegatedFeaturesErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/tenants/:tenantId/attributes/verified/:attributeId/verifiers",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

          const { offset, limit } = req.query;
          const result =
            await tenantService.getTenantVerifiedAttributeVerifiers(
              unsafeBrandId(req.params.tenantId),
              unsafeBrandId(req.params.attributeId),
              {
                offset,
                limit,
              },
              ctx
            );
          return res.status(200).send(
            tenantApi.TenantVerifiers.parse({
              results: result.results.map(toApiTenantVerifier),
              totalCount: result.totalCount,
            })
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getTenantVerifiedAttributeVerifiersErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/tenants/:tenantId/attributes/verified/:attributeId/revokers",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);
          const { offset, limit } = req.query;
          const result = await tenantService.getTenantVerifiedAttributeRevokers(
            unsafeBrandId(req.params.tenantId),
            unsafeBrandId(req.params.attributeId),
            {
              offset,
              limit,
            },
            ctx
          );
          return res.status(200).send(
            tenantApi.TenantRevokers.parse({
              results: result.results.map(toApiTenantRevoker),
              totalCount: result.totalCount,
            })
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getTenantVerifiedAttributeRevokersErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  const m2mRouter = ctx.router(tenantApi.m2mApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  m2mRouter
    .post("/m2m/tenants", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [M2M_ROLE]);

        const tenant = await tenantService.m2mUpsertTenant(req.body, ctx);
        return res
          .status(200)
          .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
      } catch (error) {
        const errorRes = makeApiProblem(error, m2mUpsertTenantErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete(
      "/m2m/origin/:origin/externalId/:externalId/attributes/:code",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [M2M_ROLE]);

          const { origin, externalId, code } = req.params;
          await tenantService.m2mRevokeCertifiedAttribute(
            {
              tenantOrigin: origin,
              tenantExternalId: externalId,
              attributeExternalId: code,
            },
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            m2mRevokeCertifiedAttributeErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  const selfcareRouter = ctx.router(tenantApi.selfcareApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  selfcareRouter
    .get("/tenants/selfcare/:selfcareId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          M2M_ROLE,
          SECURITY_ROLE,
          SUPPORT_ROLE,
          INTERNAL_ROLE,
        ]);

        const tenant = await tenantService.getTenantBySelfcareId(
          req.params.selfcareId,
          ctx
        );

        return res
          .status(200)
          .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getTenantBySelfcareIdErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/selfcare/tenants", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          INTERNAL_ROLE,
        ]);

        const id = await tenantService.selfcareUpsertTenant(req.body, ctx);
        return res.status(200).send(tenantApi.ResourceId.parse({ id }));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          selfcareUpsertTenantErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  const internalRouter = ctx.router(tenantApi.internalApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  internalRouter
    .post("/internal/tenants", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [INTERNAL_ROLE]);

        const tenant = await tenantService.internalUpsertTenant(req.body, ctx);
        return res
          .status(200)
          .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          internalUpsertTenantErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/internal/origin/:tOrigin/externalId/:tExternalId/attributes/origin/:aOrigin/externalId/:aExternalId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);

          const { tOrigin, tExternalId, aOrigin, aExternalId } = req.params;
          await tenantService.internalAssignCertifiedAttribute(
            {
              tenantOrigin: tOrigin,
              tenantExternalId: tExternalId,
              attributeOrigin: aOrigin,
              attributeExternalId: aExternalId,
            },
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            internalAddCertifiedAttributeErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/internal/origin/:tOrigin/externalId/:tExternalId/attributes/origin/:aOrigin/externalId/:aExternalId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);

          const { tOrigin, tExternalId, aOrigin, aExternalId } = req.params;
          await tenantService.internalRevokeCertifiedAttribute(
            {
              tenantOrigin: tOrigin,
              tenantExternalId: tExternalId,
              attributeOrigin: aOrigin,
              attributeExternalId: aExternalId,
            },
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            internalRevokeCertifiedAttributeErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  const tenantsAttributeRouter = ctx.router(tenantApi.tenantAttributeApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  tenantsAttributeRouter
    .post("/tenants/:tenantId/attributes/certified", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ROLE, M2M_ADMIN_ROLE]);

        const { tenantId } = req.params;
        const { data: tenant, metadata } =
          await tenantService.addCertifiedAttribute(
            {
              tenantId: unsafeBrandId(tenantId),
              tenantAttributeSeed: req.body,
            },
            ctx
          );

        setMetadataVersionHeader(res, metadata);

        return res
          .status(200)
          .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          addCertifiedAttributeErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/tenants/attributes/declared", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { data: tenant, metadata } =
          await tenantService.addDeclaredAttribute(
            {
              tenantAttributeSeed: req.body,
            },
            ctx
          );

        setMetadataVersionHeader(res, metadata);

        return res
          .status(200)
          .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          addDeclaredAttributeErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/tenants/:tenantId/attributes/verified",

      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

          const { data: tenant, metadata } =
            await tenantService.verifyVerifiedAttribute(
              {
                tenantId: unsafeBrandId(req.params.tenantId),
                attributeId: unsafeBrandId(req.body.id),
                agreementId: unsafeBrandId(req.body.agreementId),
                expirationDate: req.body.expirationDate,
              },
              ctx
            );

          setMetadataVersionHeader(res, metadata);

          return res
            .status(200)
            .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            verifyVerifiedAttributeErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/tenants/:tenantId/attributes/verified/:attributeId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

          const { data: tenant, metadata } =
            await tenantService.revokeVerifiedAttribute(
              {
                tenantId: unsafeBrandId(req.params.tenantId),
                attributeId: unsafeBrandId(req.params.attributeId),
                agreementId: unsafeBrandId(req.body.agreementId),
              },
              ctx
            );

          setMetadataVersionHeader(res, metadata);

          return res
            .status(200)
            .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            revokeVerifiedAttributeErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/tenants/:tenantId/attributes/certified/:attributeId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, M2M_ROLE, M2M_ADMIN_ROLE]);

          const { tenantId, attributeId } = req.params;
          const { data: tenant, metadata } =
            await tenantService.revokeCertifiedAttributeById(
              {
                tenantId: unsafeBrandId(tenantId),
                attributeId: unsafeBrandId(attributeId),
              },
              ctx
            );

          setMetadataVersionHeader(res, metadata);

          return res
            .status(200)
            .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            revokeCertifiedAttributeErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete("/tenants/attributes/declared/:attributeId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { data: tenant, metadata } =
          await tenantService.revokeDeclaredAttribute(
            { attributeId: unsafeBrandId(req.params.attributeId) },
            ctx
          );

        setMetadataVersionHeader(res, metadata);

        return res
          .status(200)
          .send(tenantApi.Tenant.parse(toApiTenant(tenant)));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          revokeDeclaredAttributeErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });
  return [
    tenantsRouter,
    tenantsAttributeRouter,
    m2mRouter,
    selfcareRouter,
    internalRouter,
  ];
};
export default tenantsRouter;
