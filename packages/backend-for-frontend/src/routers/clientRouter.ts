import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { selfcareV2UsersClientBuilder } from "pagopa-interop-api-clients";
import { emptyErrorMapper } from "pagopa-interop-models";
import { clientServiceBuilder } from "../services/clientService.js";
import { config } from "../config/config.js";
import { makeApiProblem } from "../model/errors.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { fromBffAppContext } from "../utilities/context.js";
import { getClientUsersErrorMapper } from "../utilities/errorMappers.js";

const clientRouter = (
  ctx: ZodiosContext,
  interopBeClients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const clientRouter = ctx.router(bffApi.clientsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const clientService = clientServiceBuilder(
    interopBeClients,
    selfcareV2UsersClientBuilder(config)
  );

  clientRouter
    .get("/clients", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const requesterId = ctx.authData.organizationId;
        const { limit, offset, userIds, kind, q } = req.query;
        const clients = await clientService.getClients(
          {
            limit,
            offset,
            userIds,
            kind,
            name: q,
            requesterId,
          },
          ctx
        );

        return res.status(200).send(bffApi.CompactClients.parse(clients));
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
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const client = await clientService.getClientById(
          req.params.clientId,
          ctx
        );

        return res.status(200).send(bffApi.Client.parse(client));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving client ${req.params.clientId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .delete("/clients/:clientId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await clientService.deleteClient(req.params.clientId, ctx);

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error deleting client ${req.params.clientId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .delete("/clients/:clientId/purposes/:purposeId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await clientService.removeClientPurpose(
          req.params.clientId,
          req.params.purposeId,
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error removing purpose ${req.params.purposeId} from client ${req.params.clientId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/clients/:clientId/keys/:keyId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const key = await clientService.getClientKeyById(
          req.params.clientId,
          req.params.keyId,
          ctx.authData.selfcareId,
          ctx
        );

        return res.status(200).send(bffApi.PublicKey.parse(key));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving keys of client ${req.params.clientId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/clients/:clientId/keys/:keyId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await clientService.deleteClientKeyById(
          req.params.clientId,
          req.params.keyId,
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error deleting key ${req.params.keyId} of client ${req.params.clientId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/clients/:clientId/users", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await clientService.addUsersToClient(
          req.body.userIds,
          req.params.clientId,
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error adding users ${req.body.userIds.join(",")} to client ${
            req.params.clientId
          }`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .delete("/clients/:clientId/users/:userId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await clientService.removeUser(
          req.params.clientId,
          req.params.userId,
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error removing user ${req.params.userId} from client ${req.params.clientId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/clients/:clientId/purposes", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await clientService.addClientPurpose(
          req.params.clientId,
          req.body,
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error adding purpose to client ${req.body.purposeId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/clients/:clientId/users", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const users = await clientService.getClientUsers(
          req.params.clientId,
          ctx.authData.selfcareId,
          ctx
        );

        return res.status(200).send(bffApi.CompactUsers.parse(users));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getClientUsersErrorMapper,
          ctx,
          `Error retrieving users of client ${req.params.clientId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/clients/:clientId/keys", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await clientService.createKey(req.params.clientId, req.body, ctx);

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating keys for client ${req.params.clientId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/clients/:clientId/keys", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const keys = await clientService.getClientKeys(
          {
            clientId: req.params.clientId,
            userIds: req.query.userIds,
            limit: req.query.limit,
            offset: req.query.offset,
          },
          ctx
        );

        return res.status(200).send(bffApi.PublicKeys.parse(keys));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving keys of client ${req.params.clientId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/clients/:clientId/encoded/keys/:keyId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const key = await clientService.getEncodedClientKeyById(
          req.params.clientId,
          req.params.keyId,
          ctx
        );

        return res.status(200).send(bffApi.EncodedClientKey.parse(key));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving key ${req.params.keyId} for client ${req.params.clientId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/clientsConsumer", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await clientService.createConsumerClient(req.body, ctx);

        return res.status(200).send(bffApi.CreatedResource.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating consumer client with name ${req.body.name}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/clientsApi", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await clientService.createApiClient(req.body, ctx);

        return res.status(200).send(bffApi.CreatedResource.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating api client with name ${req.body.name}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });
  return clientRouter;
};

export default clientRouter;
