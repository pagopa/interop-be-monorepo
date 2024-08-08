import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { tenantServiceBuilder } from "../services/tenantService.js";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { fromBffAppContext } from "../utilities/context.js";
import { emptyErrorMapper } from "../utilities/errorMappers.js";
import { makeApiProblem } from "../model/domain/errors.js";

const tenantRouter = (
  ctx: ZodiosContext,
  clients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const tenantRouter = ctx.router(bffApi.tenantsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const tenantService = tenantServiceBuilder(clients.tenantProcessClient);

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

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error retrieving consumers for name ${req.query.q}, offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).json(errorRes).end();
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

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error retrieving producers for name ${req.query.q}, offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
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
