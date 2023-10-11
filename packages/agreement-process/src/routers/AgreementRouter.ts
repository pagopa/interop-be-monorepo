import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { ExpressContext, ZodiosContext } from "pagopa-interop-commons";
import { api } from "../model/generated/api.js";

const agreementRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const agreementRouter = ctx.router(api.api);

  agreementRouter.post("/agreements/:agreementId/submit", async (_req, res) => {
    res.status(200).send();
  });

  agreementRouter.post(
    "/agreements/:agreementId/activate",
    async (_req, res) => {
      res.status(200).send();
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/consumer-documents",
    async (_req, res) => {
      res.status(200).send();
    }
  );

  agreementRouter.get(
    "/agreements/:agreementId/consumer-documents/:documentId",
    async (_req, res) => {
      res.status(200).send();
    }
  );

  agreementRouter.delete(
    "/agreements/:agreementId/consumer-documents/:documentId",
    async (_req, res) => {
      res.status(200).send();
    }
  );

  agreementRouter.post(
    "/agreements/:agreementId/suspend",
    async (_req, res) => {
      res.status(200).send();
    }
  );

  agreementRouter.post("/agreements/:agreementId/reject", async (_req, res) => {
    res.status(200).send();
  });

  agreementRouter.post(
    "/agreements/:agreementId/archive",
    async (_req, res) => {
      res.status(200).send();
    }
  );

  agreementRouter.post("/agreements", async (_req, res) => {
    res.status(200).send();
  });

  agreementRouter.get("/agreements", async (_req, res) => {
    res.status(200).send();
  });

  agreementRouter.get("/producers", async (_req, res) => {
    res.status(200).send();
  });

  agreementRouter.get("/consumers", async (_req, res) => {
    res.status(200).send();
  });

  agreementRouter.get("/agreements/:agreementId", async (_req, res) => {
    res.status(200).send();
  });

  agreementRouter.delete("/agreements/:agreementId", async (_req, res) => {
    res.status(200).send();
  });

  agreementRouter.post("/agreements/:agreementId/update", async (_req, res) => {
    res.status(200).send();
  });

  agreementRouter.post(
    "/agreements/:agreementId/upgrade",
    async (_req, res) => {
      res.status(200).send();
    }
  );

  agreementRouter.post("/agreements/:agreementId/clone", async (_req, res) => {
    res.status(200).send();
  });

  agreementRouter.post("/compute/agreementsState", async (_req, res) => {
    res.status(200).send();
  });

  agreementRouter.get("/agreements/filter/eservices", async (_req, res) => {
    res.status(200).send();
  });

  return agreementRouter;
};
export default agreementRouter;
