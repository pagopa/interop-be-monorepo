import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";

const tenantRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const tenantRouter = ctx.router(bffApi.tenantsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  tenantRouter
    .get("/consumers", async (_req, res) => res.status(501).send())
    .get("/producers", async (_req, res) => res.status(501).send())
    .get("/tenants/attributes/certified", async (_req, res) =>
      res.status(501).send()
    )
    .get("/tenants/:tenantId/attributes/certified", async (_req, res) =>
      res.status(501).send()
    )
    .post("/tenants/:tenantId/attributes/certified", async (_req, res) =>
      res.status(501).send()
    )
    .post("/tenants/attributes/declared", async (_req, res) =>
      res.status(501).send()
    )
    .delete("/tenants/attributes/declared/:attributeId", async (_req, res) =>
      res.status(501).send()
    )
    .get("/tenants/:tenantId/attributes/declared", async (_req, res) =>
      res.status(501).send()
    )
    .get("/tenants/:tenantId/attributes/verified", async (_req, res) =>
      res.status(501).send()
    )
    .post("/tenants/:tenantId/attributes/verified", async (_req, res) =>
      res.status(501).send()
    )
    .delete(
      "/tenants/:tenantId/attributes/certified/:attributeId",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/tenants/:tenantId/attributes/verified/:attributeId",
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/tenants/:tenantId/attributes/verified/:attributeId",
      async (_req, res) => res.status(501).send()
    )
    .get("/tenants/:tenantId", async (_req, res) => res.status(501).send())
    .post("/tenants/:tenantId/mails", async (_req, res) =>
      res.status(501).send()
    )
    .delete("/tenants/:tenantId/mails/:mailId", async (_req, res) =>
      res.status(501).send()
    )
    .get("/tenants", async (_req, res) => res.status(501).send());

  return tenantRouter;
};

export default tenantRouter;
