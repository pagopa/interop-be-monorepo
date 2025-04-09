import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  fromAppContext,
} from "pagopa-interop-commons";
import { makeApiProblem } from "../model/errors.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { emptyErrorMapper } from "../utilities/errorMappers.js";
import { tenantServiceBuilder } from "../services/tenantService.js";

const tenantRouter = (
  ctx: ZodiosContext,
  clients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const tenantRouter = ctx.router(m2mGatewayApi.tenantsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const tenantService = tenantServiceBuilder(clients);
  void tenantService;

  tenantRouter
    .get("/tenants", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error retrieving tenants"
        );
        return res.status(errorRes.status).send();
      }
    })
    .get("/tenants/:tenantId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving tenant with id ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send();
      }
    })
    .get("/tenants/:tenantId/certifiedAttributes", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving tenant ${req.params.tenantId} certified attributes`
        );
        return res.status(errorRes.status).send();
      }
    })
    .post("/tenants/:tenantId/certifiedAttributes", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error assigning certified attribute to tenant ${req.params.tenantId}`
        );
        return res.status(errorRes.status).send();
      }
    })
    .delete(
      "/tenants/:tenantId/certifiedAttributes/:attributeId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          return res.status(501).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error revoking certified attribute ${req.params.attributeId} from tenant ${req.params.tenantId}`
          );
          return res.status(errorRes.status).send();
        }
      }
    );

  return tenantRouter;
};

export default tenantRouter;
