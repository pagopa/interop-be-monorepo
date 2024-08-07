import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";

const producerKeychainRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const producerKeychainRouter = ctx.router(bffApi.producerKeychainApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  producerKeychainRouter
    .get("/producerKeychains", async (_req, res) => res.status(501).send())
    .post("/producerKeychains", async (_req, res) => res.status(501).send())
    .get("/producerKeychains/:producerKeychainId", async (_req, res) =>
      res.status(501).send()
    )
    .delete("/producerKeychains/:producerKeychainId", async (_req, res) =>
      res.status(501).send()
    )
    .post(
      "/producerKeychains/:producerKeychainId/eservices",
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/producerKeychains/:producerKeychainId/eservices/:eserviceId",
      async (_req, res) => res.status(501).send()
    )
    .post("/producerKeychains/:producerKeychainId/keys", async (_req, res) =>
      res.status(501).send()
    )
    .get("/producerKeychains/:producerKeychainId/keys", async (_req, res) =>
      res.status(501).send()
    )
    .get(
      "/producerKeychains/:producerKeychainId/keys/:keyId",
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/producerKeychains/:producerKeychainId/keys/:keyId",
      async (_req, res) => res.status(501).send()
    )
    .get("/producerKeychains/:producerKeychainId/users", async (_req, res) =>
      res.status(501).send()
    )
    .post(
      "/producerKeychains/:producerKeychainId/users/:userId",
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/producerKeychains/:producerKeychainId/users/:userId",
      async (_req, res) => res.status(501).send()
    );

  return producerKeychainRouter;
};

export default producerKeychainRouter;
