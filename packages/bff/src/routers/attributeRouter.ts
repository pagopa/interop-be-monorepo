import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  fromAppContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { api } from "../model/generated/api.js";
import { PagoPaClients } from "../providers/clientProvider.js";
import { attributeServiceBuilder } from "../services/attributeService.js";

const attributeRouter = (
  ctx: ZodiosContext,
  { attributeProcessClient }: PagoPaClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const attributeRouter = ctx.router(api.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const attributeService = attributeServiceBuilder(attributeProcessClient);

  attributeRouter
    .post("/certifiedAttributes", async (_req, res) => res.status(501).send())
    .post("/verifiedAttributes", async (_req, res) => res.status(501).send())
    .post("/declaredAttributes", async (_req, res) => res.status(501).send())
    .get("/attributes", async (_req, res) => res.status(501).send())

    .get("/attributes/:attributeId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      const requestHeaders = {
        "X-Correlation-Id": ctx.correlationId,
        Authorization: req.headers.authorization as string,
      };
      const result = await attributeService.getAttributeById(
        req.params.attributeId,
        requestHeaders
      );

      res.status(200).json(result).end();
    })

    .get("/attributes/origin/:origin/code/:code", async (_req, res) =>
      res.status(501).send()
    );

  return attributeRouter;
};

export default attributeRouter;
