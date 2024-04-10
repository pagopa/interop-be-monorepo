import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
} from "pagopa-interop-commons";
import { api } from "../model/generated/api.js";

const purposeRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const purposeRouter = ctx.router(api.api);
  const { ADMIN_ROLE } = userRoles;
  purposeRouter
    .get("/purposes", authorizationMiddleware([ADMIN_ROLE]), (_req, res) =>
      res.status(501).send()
    )
    .post("/purposes", authorizationMiddleware([ADMIN_ROLE]), (_req, res) =>
      res.status(501).send()
    )
    .post(
      "/reverse/purposes",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
    )
    .post(
      "/reverse/purposes/:id",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
    )
    .get("/purposes/:id", authorizationMiddleware([ADMIN_ROLE]), (_req, res) =>
      res.status(501).send()
    )
    .post("/purposes/:id", authorizationMiddleware([ADMIN_ROLE]), (_req, res) =>
      res.status(501).send()
    )
    .delete(
      "/purposes/:id",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId/versions",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
    )
    .delete(
      "/purposes/:purposeId/versions/:versionId",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
    )
    .get(
      "/purposes/:purposeId/versions/:versionId/documents/:documentId",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/reject",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/activate",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId/clone",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/suspend",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/archive",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/update/waitingForApproval",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
    )
    .get(
      "/purposes/riskAnalysis/latest",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
    )
    .get(
      "/purposes/riskAnalysis/version/:riskAnalysisVersion",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
    );

  return purposeRouter;
};
export default purposeRouter;
