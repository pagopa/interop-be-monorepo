import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
// import { producerKeychainServiceBuilder } from "../services/producerKeychainService.js";

const producerKeychainRouter = (
  ctx: ZodiosContext,
  _processClients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const producerKeychainRouter = ctx.router(bffApi.producerKeychainApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  // const producerKeychainService =
  //   producerKeychainServiceBuilder(processClients);

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
