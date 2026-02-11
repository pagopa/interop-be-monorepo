import { constants } from "http2";
import { Router } from "express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter, zodiosRouter } from "@zodios/express";
import {
  CorrelationId,
  generateId,
  Problem,
  ProblemSchema,
} from "pagopa-interop-models";
import { ExpressContext } from "../context/context.js";

type RequiresHealthStatus = [
  {
    method: "get";
    path: "/status";
    response: typeof ProblemSchema;
  }
];

export const healthRouter = (
  api: ZodiosEndpointDefinitions & RequiresHealthStatus
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const healthRouter = zodiosRouter(api);
  healthRouter.get("/status", async (_req, res) => {
    const healthProblem: Problem = {
      type: "about:blank",
      correlationId: generateId<CorrelationId>(),
      status: constants.HTTP_STATUS_OK,
      title: "Service status OK",
    };

    res.type("application/problem+json").status(200).send(healthProblem);
  });

  return healthRouter;
};

export function healthRouterSimple(): Router {
  const router = Router();
  router.get("/status", async (_req, res) => {
    const healthProblem: Problem = {
      type: "about:blank",
      correlationId: generateId<CorrelationId>(),
      status: constants.HTTP_STATUS_OK,
      title: "Service status OK",
    };

    res.type("application/problem+json").status(200).send(healthProblem);
  });

  return router;
}
