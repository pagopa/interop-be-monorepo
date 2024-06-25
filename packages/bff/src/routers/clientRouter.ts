import { selfcareV2ClientBuilder } from "pagopa-interop-selfcare-v2-client";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  fromAppContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { clientServiceBuilder } from "../services/clientService.js";
import {
  emptyErrorMapper,
  getClientUsersErrorMapper,
} from "../utilities/errorMappers.js";
import { makeApiProblem } from "../model/domain/errors.js";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { toBffApiCompactClient } from "../model/domain/apiConverter.js";
import { config } from "../utilities/config.js";

const clientRouter = (
  ctx: ZodiosContext,
  processClients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const clientRouter = ctx.router(bffApi.clientsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const clientService = clientServiceBuilder(
    processClients,
    selfcareV2ClientBuilder(config)
  );

  clientRouter
    .get("/clients", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        const headers = {
          "X-Correlation-Id": ctx.correlationId,
          Authorization: req.headers.authorization as string,
        };

        const requesterId = ctx.authData.organizationId;
        const { limit, offset, userIds, kind, q } = req.query;
        const clients = await clientService.getClients({
          headers,
          limit,
          offset,
          userIds,
          kind,
          name: q,
          requesterId,
        });

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
      const ctx = fromAppContext(req.ctx);
      try {
        const requestHeaders = {
          "X-Correlation-Id": ctx.correlationId,
          Authorization: req.headers.authorization as string,
        };

        const client = await clientService.getClientById(
          req.params.clientId,
          requestHeaders,
          ctx.logger
        );

        return res.status(200).json(client).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          clientEmptyErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .delete("/clients/:clientId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        const requestHeaders = {
          "X-Correlation-Id": ctx.correlationId,
          Authorization: req.headers.authorization as string,
        };

        await clientService.deleteClient(
          req.params.clientId,
          requestHeaders,
          ctx.logger
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          clientEmptyErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .delete("/clients/:clientId/purposes/:purposeId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        const requestHeaders = {
          "X-Correlation-Id": ctx.correlationId,
          Authorization: req.headers.authorization as string,
        };

        await clientService.removeClientPurpose(
          req.params.clientId,
          req.params.purposeId,
          requestHeaders,
          ctx.logger
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          clientEmptyErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .get("/clients/:clientId/keys/:keyId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        const headers = {
          "X-Correlation-Id": ctx.correlationId,
          Authorization: req.headers.authorization as string,
        };

        const key = await clientService.getClientKeyById(
          req.params.clientId,
          req.params.keyId,
          ctx.authData.selfcareId,
          headers,
          ctx.logger
        );

        return res.status(200).json(key).end();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .delete("/clients/:clientId/keys/:keyId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const requestHeaders = {
          "X-Correlation-Id": ctx.correlationId,
          Authorization: req.headers.authorization as string,
        };

        await clientService.deleteClientKeyById(
          req.params.clientId,
          req.params.keyId,
          requestHeaders,
          ctx.logger
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          clientEmptyErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/clients/:clientId/users/:userId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const requestHeaders = {
          "X-Correlation-Id": ctx.correlationId,
          Authorization: req.headers.authorization as string,
        };

        await clientService.addUserToClient(
          req.params.userId,
          req.params.clientId,
          requestHeaders,
          ctx.logger
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          clientEmptyErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .delete("/clients/:clientId/users/:userId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const requestHeaders = {
          "X-Correlation-Id": ctx.correlationId,
          Authorization: req.headers.authorization as string,
        };

        await clientService.removeUser(
          req.params.clientId,
          req.params.userId,
          requestHeaders,
          ctx.logger
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          clientEmptyErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/clients/:clientId/purposes", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const requestHeaders = {
          "X-Correlation-Id": ctx.correlationId,
          Authorization: req.headers.authorization as string,
        };

        await clientService.addClientPurpose(
          req.params.clientId,
          req.body,
          requestHeaders,
          ctx.logger
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          clientEmptyErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .get("/clients/:clientId/users", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const headers = {
          "X-Correlation-Id": ctx.correlationId,
          Authorization: req.headers.authorization as string,
        };

        const users = await clientService.getClientUsers(
          req.params.clientId,
          ctx.authData.selfcareId,
          headers,
          ctx.logger
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
      const ctx = fromAppContext(req.ctx);
      try {
        const requestHeaders = {
          "X-Correlation-Id": ctx.correlationId,
          Authorization: req.headers.authorization as string,
        };

        await clientService.createKeys(
          ctx.authData.userId,
          req.params.clientId,
          req.body,
          requestHeaders,
          ctx.logger
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          clientEmptyErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get("/clients/:clientId/keys", async (_req, res) => res.status(501).send())
    .get("/clients/:clientId/encoded/keys/:keyId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        const headers = {
          "X-Correlation-Id": ctx.correlationId,
          Authorization: req.headers.authorization as string,
        };

        const key = await clientService.getEncodedClientKeyById(
          req.params.clientId,
          req.params.keyId,
          headers,
          ctx.logger
        );

        return res.status(200).json(key).end();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/clientsConsumer", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const headers = {
          "X-Correlation-Id": ctx.correlationId,
          Authorization: req.headers.authorization as string,
        };

        const result = await clientService.createConsumerClient(
          req.body,
          headers,
          ctx.logger
        );

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .post("/clientsApi", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        const headers = {
          "X-Correlation-Id": ctx.correlationId,
          Authorization: req.headers.authorization as string,
        };

        const result = await clientService.createApiClient(
          req.body,
          headers,
          ctx.logger
        );

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })

    .get("/clients/:clientId/users/:userId/keys", async (_req, res) =>
      res.status(501).send()
    );

  return clientRouter;
};

export default clientRouter;
