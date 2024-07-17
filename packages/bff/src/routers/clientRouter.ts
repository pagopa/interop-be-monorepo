import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";

const clientRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const clientRouter = ctx.router(bffApi.clientsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  clientRouter
    .get("/clients", async (_req, res) => res.status(501).send())
    .get("/clients/:clientId", async (_req, res) => res.status(501).send())
    .delete("/clients/:clientId", async (_req, res) => res.status(501).send())
    .delete("/clients/:clientId/purposes/:purposeId", async (_req, res) =>
      res.status(501).send()
    )
    .get("/clients/:clientId/keys/:keyId", async (_req, res) =>
      res.status(501).send()
    )
    .delete("/clients/:clientId/keys/:keyId", async (_req, res) =>
      res.status(501).send()
    )
    .post("/clients/:clientId/users/:userId", async (_req, res) =>
      res.status(501).send()
    )
    .delete("/clients/:clientId/users/:userId", async (_req, res) =>
      res.status(501).send()
    )
    .post("/clients/:clientId/purposes", async (_req, res) =>
      res.status(501).send()
    )
    .get("/clients/:clientId/users", async (_req, res) =>
      res.status(501).send()
    )
    .post("/clients/:clientId/keys", async (_req, res) =>
      res.status(501).send()
    )
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
