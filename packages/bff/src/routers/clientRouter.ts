import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { selfcareV2UsersClientBuilder } from "pagopa-interop-api-clients";
import { clientServiceBuilder } from "../services/clientService.js";
import { config } from "../config/config.js";
import { makeApiProblem } from "../model/errors.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { fromBffAppContext } from "../utilities/context.js";
import {
  emptyErrorMapper,
  getClientUsersErrorMapper,
} from "../utilities/errorMappers.js";
import { toBffApiCompactClient } from "../api/authorizationApiConverter.js";

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

        return res
          .status(200)
          .json({
            results: clients.results.map(toBffApiCompactClient),
            pagination: {
              limit,
              offset,
              totalCount: clients.totalCount,
            },
          })
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          "Error retrieving clients"
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .get("/clients/:clientId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const client = await clientService.getClientById(
          req.params.clientId,
          ctx
        );

        return res.status(200).json(client).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error retrieving client ${req.params.clientId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
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
          ctx.logger,
          `Error deleting client ${req.params.clientId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
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
          ctx.logger,
          `Error removing purpose ${req.params.purposeId} from client ${req.params.clientId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
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

        return res.status(200).json(key).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error retrieving keys of client ${req.params.clientId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
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
          ctx.logger,
          `Error deleting key ${req.params.keyId} of client ${req.params.clientId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/clients/:clientId/users/:userId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const createdUser = await clientService.addUserToClient(
          req.params.userId,
          req.params.clientId,
          ctx
        );

        return res.status(200).json(createdUser);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error adding user ${req.params.userId} to client ${req.params.clientId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
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
          ctx.logger,
          `Error removing user ${req.params.userId} from client ${req.params.clientId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
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
          ctx.logger,
          `Error adding purpose to client ${req.body.purposeId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
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

        return res.status(200).json(users).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getClientUsersErrorMapper,
          ctx.logger,
          `Error retrieving users of client ${req.params.clientId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/clients/:clientId/keys", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await clientService.createKeys(req.params.clientId, req.body, ctx);

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error creating keys for client ${req.params.clientId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .get("/clients/:clientId/keys", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const keys = await clientService.getClientKeys(
          req.params.clientId,
          req.query.userIds,
          ctx
        );

        return res.status(200).json({ keys }).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error retrieving keys of client ${req.params.clientId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
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

        return res.status(200).json(key).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error retrieving key ${req.params.keyId} for client ${req.params.clientId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/clientsConsumer", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await clientService.createConsumerClient(req.body, ctx);

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error creating consumer client with name ${req.body.name}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/clientsApi", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await clientService.createApiClient(req.body, ctx);

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error creating api client with name ${req.body.name}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    });
  return clientRouter;
};

export default clientRouter;
