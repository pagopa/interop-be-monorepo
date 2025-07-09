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
import { ClientService } from "../services/clientService.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";

const { M2M_ROLE, M2M_ADMIN_ROLE } = authRole;

const clientRouter = (
  ctx: ZodiosContext,
  clientService: ClientService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const clientRouter = ctx.router(m2mGatewayApi.clientsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  clientRouter
    .get("/clients", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const clients = await clientService.getClients(req.query, ctx);

        return res.status(200).send(m2mGatewayApi.Clients.parse(clients));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error retrieving clients"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/clients/:clientId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const client = await clientService.getClient(
          unsafeBrandId(req.params.clientId),
          ctx
        );
        return res.status(200).send(m2mGatewayApi.Client.parse(client));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving client with id ${req.params.clientId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/clients/:clientId/purposes", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const purposes = await clientService.getClientPurposes(
          unsafeBrandId(req.params.clientId),
          req.query,
          ctx
        );
        return res.status(200).send(m2mGatewayApi.Purposes.parse(purposes));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving purposes for client with id ${req.params.clientId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/clients/:clientId/purposes", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        await clientService.addClientPurpose(
          unsafeBrandId(req.params.clientId),
          req.body,
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error adding purpose to client with id ${req.params.clientId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/clients/:clientId/purposes/:purposeId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        await clientService.removeClientPurpose(
          unsafeBrandId(req.params.clientId),
          unsafeBrandId(req.params.purposeId),
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,

          `Error removing purpose with id ${req.params.purposeId} from client with id ${req.params.clientId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/clients/:clientId/keys", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const keys = await clientService.getClientKeys(
          unsafeBrandId(req.params.clientId),
          req.query,
          ctx
        );
        return res.status(200).send(m2mGatewayApi.JWKs.parse(keys));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving keys for client with id ${req.params.clientId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return clientRouter;
};

export default clientRouter;
