import { ZodiosRouter } from "@zodios/express";
import { ExpressContext, ZodiosContext } from "pagopa-interop-commons";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { api } from "../model/generated/api.js";

const healthRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const healthRouter = ctx.router(api.api);
  healthRouter.get("/status", async (_, res) => res.status(200).end());

  return healthRouter;
};

export default healthRouter;
