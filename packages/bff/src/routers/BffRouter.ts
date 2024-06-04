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

const bffRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const bffRouter = ctx.router(api.api, {
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

  bffRouter
    .get(
      "/agreements",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/agreements",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/agreements/filter/producers",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/agreements/filter/consumers",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/agreements/:agreementId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/agreements/:agreementId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/agreements/:agreementId/activate",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/agreements/:agreementId/clone",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/agreements/:agreementId/consumer-documents",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/agreements/:agreementId/consumer-documents/:documentId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/agreements/:agreementId/consumer-documents/:documentId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/agreements/:agreementId/contract",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/agreements/:agreementId/submit",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/agreements/:agreementId/suspend",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/agreements/:agreementId/reject",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/agreements/:agreementId/archive",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/agreements/:agreementId/update",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/agreements/:agreementId/upgrade",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get("/catalog", authorizationMiddleware([ADMIN_ROLE]), async (_req, res) =>
      res.status(501).send()
    )
    .get(
      "/consumers",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/eservices/:eServiceId/consumers",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .put(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/activate",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/update",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/publish",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/suspend",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/clone",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/eservices/:eServiceId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .put(
      "/eservices/:eServiceId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/riskAnalysis",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/producers",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/producers/eservices",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/producers/agreements/eservices",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/consumers/agreements/eservices",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/producers/eservices/:eserviceId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/producers/eservices/:eserviceId/descriptors/:descriptorId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/reverse/purposes",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/reverse/purposes/:purposeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/catalog/eservices/:eserviceId/descriptor/:descriptorId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/session/tokens",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/tenants/:tenantId/users",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/tools/validateTokenGeneration",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/users/:userId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/tenants/attributes/certified",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/tenants/:tenantId/attributes/certified",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/tenants/:tenantId/attributes/certified",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/producer/purposes",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/consumer/purposes",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId/clone",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId/versions",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/purposes/:purposeId/versions/:versionId/documents/:documentId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/reject",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/archive",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/suspend",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/activate",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/tenants/attributes/declared",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/tenants/attributes/declared/:attributeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/purposes/:purposeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/purposes/:purposeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/purposes/:purposeId/versions/:versionId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/tenants/:tenantId/attributes/declared",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/tenants/:tenantId/attributes/verified",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/tenants/:tenantId/attributes/verified",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/tenants/:tenantId/attributes/certified/:attributeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/tenants/:tenantId/attributes/verified/:attributeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/tenants/:tenantId/attributes/verified/:attributeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/certifiedAttributes",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/verifiedAttributes",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/declaredAttributes",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/attributes",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/attributes/:attributeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/attributes/origin/:origin/code/:code",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/tenants/:tenantId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/tenants/:tenantId/mails",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/tenants/:tenantId/mails/:mailId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get("/tenants", authorizationMiddleware([ADMIN_ROLE]), async (_req, res) =>
      res.status(501).send()
    )
    .get("/clients", authorizationMiddleware([ADMIN_ROLE]), async (_req, res) =>
      res.status(501).send()
    )
    .get(
      "/clients/:clientId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/clients/:clientId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/clients/:clientId/purposes/:purposeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/clients/:clientId/keys/:keyId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/clients/:clientId/keys/:keyId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/clients/:clientId/users/:userId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/clients/:clientId/users/:userId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/clients/:clientId/purposes",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/selfcare/institutions/products",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/selfcare/institutions",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/clients/:clientId/users",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/clients/:clientId/keys",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/clients/:clientId/keys",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/clients/:clientId/encoded/keys/:keyId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/clientsConsumer",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/clientsApi",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/clients/:clientId/users/:userId/keys",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/purposes/riskAnalysis/latest",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/purposes/riskAnalysis/version/:riskAnalysisVersion",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/user/consent/:consentType",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/user/consent/:consentType",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/privacyNotices/:consentType",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/support",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/session/saml2/tokens",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get("/status", authorizationMiddleware([ADMIN_ROLE]), async (_req, res) =>
      res.status(501).send()
    );

  return bffRouter;
};

export default bffRouter;
