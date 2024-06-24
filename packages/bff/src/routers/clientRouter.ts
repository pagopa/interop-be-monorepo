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
import { clientEmptyErrorMapper } from "../utilities/errorMapper.js";
import { makeApiProblem } from "../model/domain/errors.js";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";

const clientRouter = (
  ctx: ZodiosContext,
  processClients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const clientRouter = ctx.router(bffApi.clientsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const clientService = clientServiceBuilder(processClients);

  clientRouter
    .get("/clients", async (_req, res) => res.status(501).send())
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

    .get("/clients/:clientId/keys/:keyId", async (_req, res) =>
      res.status(501).send()
    )
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

    .get("/clients/:clientId/users", async (_req, res) =>
      res.status(501).send()
    )

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
    .get("/clients/:clientId/encoded/keys/:keyId", async (_req, res) =>
      res.status(501).send()
    )
    .post("/clientsConsumer", async (_req, res) => res.status(501).send())
    .post("/clientsApi", async (_req, res) => res.status(501).send())
    .get("/clients/:clientId/users/:userId/keys", async (_req, res) =>
      res.status(501).send()
    );

  return clientRouter;
};

export default clientRouter;
