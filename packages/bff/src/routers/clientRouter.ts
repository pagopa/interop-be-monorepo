import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
  authorizationMiddleware,
  userRoles,
} from "pagopa-interop-commons";
import { api } from "../model/generated/api.js";

const clientRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const clientRouter = ctx.router(api.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  const {
    ADMIN_ROLE,
    // SECURITY_ROLE,
    // API_ROLE,
    // M2M_ROLE,
    // INTERNAL_ROLE,
    // SUPPORT_ROLE,
  } = userRoles;

  clientRouter
    .get("/clients", authorizationMiddleware([ADMIN_ROLE]), async (_req, res) =>
      res.status(501).send()
    )
    .get(
      "/clients/:clientId/keys/:keyId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/clients/:clientId/keys/:keyId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/clients/:clientId/users/:userId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/clients/:clientId/users/:userId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/clients/:clientId/purposes",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/clients/:clientId/users",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/clients/:clientId/keys",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/clients/:clientId/keys",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/clients/:clientId/encoded/keys/:keyId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/clientsConsumer",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/clientsApi",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/clients/:clientId/users/:userId/keys",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    );

  return clientRouter;
};

export default clientRouter;
