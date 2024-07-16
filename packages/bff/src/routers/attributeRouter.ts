import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";

const attributeRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const attributeRouter = ctx.router(bffApi.attributesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  attributeRouter
    .post("/certifiedAttributes", async (_req, res) => res.status(501).send())
    .post("/verifiedAttributes", async (_req, res) => res.status(501).send())
    .post("/declaredAttributes", async (_req, res) => res.status(501).send())
    .get("/attributes", async (_req, res) => res.status(501).send())
    .get("/attributes/:attributeId", async (_req, res) =>
      res.status(501).send()
    )
    .get("/attributes/origin/:origin/code/:code", async (_req, res) =>
      res.status(501).send()
    );

  return attributeRouter;
};

export default attributeRouter;
