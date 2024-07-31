import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import {
  bffApi,
  selfcareV2UsersClientBuilder,
} from "pagopa-interop-api-clients";
import { clientServiceBuilder } from "../services/clientService.js";
import { config } from "../config/config.js";
import { makeApiProblem } from "../model/domain/errors.js";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { fromBffAppContext } from "../utilities/context.js";
import {
  emptyErrorMapper,
  getClientUsersErrorMapper,
} from "../utilities/errorMappers.js";
import { toBffApiCompactClient } from "../model/api/apiConverter.js";

const clientRouter = (
  ctx: ZodiosContext,
  processClients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const clientRouter = ctx.router(bffApi.clientsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const clientService = clientServiceBuilder(
    processClients,
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
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
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
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .delete("/clients/:clientId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await clientService.deleteClient(req.params.clientId, ctx);

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
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
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
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
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
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
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
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
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
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
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
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
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
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
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/clients/:clientId/keys", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await clientService.createKeys(
          ctx.authData.userId,
          req.params.clientId,
          req.body,
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
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
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
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
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/clientsConsumer", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await clientService.createConsumerClient(req.body, ctx);

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/clientsApi", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await clientService.createApiClient(req.body, ctx);

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    });
  return clientRouter;
};

export default clientRouter;
