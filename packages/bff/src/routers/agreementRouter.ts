import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { api } from "../model/generated/api.js";
import { makeApiProblem } from "../model/domain/errors.js";
import { agreementServiceBuilder } from "../services/agreementService.js";
import { fromBffAppContext } from "../utilities/context.js";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { emptyErrorMapper } from "../utilities/errorMappers.js";

const agreementRouter = (
  ctx: ZodiosContext,
  { agreementProcessClient }: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const agreementRouter = ctx.router(api.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const agreementService = agreementServiceBuilder(agreementProcessClient);

  agreementRouter
    .get("/agreements", async (_req, res) => res.status(501).send())
    .post("/agreements", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result = await agreementService.createAgreement(req.body, ctx);
        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get("/producers/agreements/eservices", async (_req, res) =>
      res.status(501).send()
    )
    .get("/consumers/agreements/eservices", async (_req, res) =>
      res.status(501).send()
    )
    .get("/agreements/filter/producers", async (_req, res) =>
      res.status(501).send()
    )
    .get("/agreements/filter/consumers", async (_req, res) =>
      res.status(501).send()
    )
    .get("/agreements/:agreementId", async (_req, res) =>
      res.status(501).send()
    )
    .delete("/agreements/:agreementId", async (_req, res) =>
      res.status(501).send()
    )
    .post("/agreements/:agreementId/activate", async (_req, res) =>
      res.status(501).send()
    )
    .post("/agreements/:agreementId/clone", async (_req, res) =>
      res.status(501).send()
    )
    .post("/agreements/:agreementId/consumer-documents", async (_req, res) =>
      res.status(501).send()
    )
    .get(
      "/agreements/:agreementId/consumer-documents/:documentId",
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/agreements/:agreementId/consumer-documents/:documentId",
      async (_req, res) => res.status(501).send()
    )
    .get("/agreements/:agreementId/contract", async (_req, res) =>
      res.status(501).send()
    )
    .post("/agreements/:agreementId/submit", async (_req, res) =>
      res.status(501).send()
    )
    .post("/agreements/:agreementId/suspend", async (_req, res) =>
      res.status(501).send()
    )
    .post("/agreements/:agreementId/reject", async (_req, res) =>
      res.status(501).send()
    )
    .post("/agreements/:agreementId/archive", async (_req, res) =>
      res.status(501).send()
    )
    .post("/agreements/:agreementId/update", async (_req, res) =>
      res.status(501).send()
    )
    .post("/agreements/:agreementId/upgrade", async (_req, res) =>
      res.status(501).send()
    );

  return agreementRouter;
};

export default agreementRouter;
