import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { api } from "../model/generated/api.js";

const purposeRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const purposeRouter = ctx.router(api.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  purposeRouter
    .post("/reverse/purposes", async (_req, res) => res.status(501).send())
    .post("/reverse/purposes/:purposeId", async (_req, res) =>
      res.status(501).send()
    )
    .post("/purposes", async (_req, res) => res.status(501).send())
    .get("/producer/purposes", async (_req, res) => res.status(501).send())
    .get("/consumer/purposes", async (_req, res) => res.status(501).send())
    .post("/purposes/:purposeId/clone", async (_req, res) =>
      res.status(501).send()
    )
    .post("/purposes/:purposeId/versions", async (_req, res) =>
      res.status(501).send()
    )
    .get(
      "/purposes/:purposeId/versions/:versionId/documents/:documentId",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/reject",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/archive",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/suspend",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/activate",
      async (_req, res) => res.status(501).send()
    )
    .get("/purposes/:purposeId", async (_req, res) => res.status(501).send())
    .delete("/purposes/:purposeId", async (_req, res) => res.status(501).send())
    .post("/purposes/:purposeId", async (_req, res) => res.status(501).send())
    .delete("/purposes/:purposeId/versions/:versionId", async (_req, res) =>
      res.status(501).send()
    )
    .get("/purposes/riskAnalysis/latest", async (_req, res) =>
      res.status(501).send()
    )
    .get(
      "/purposes/riskAnalysis/version/:riskAnalysisVersion",
      async (_req, res) => res.status(501).send()
    );

  return purposeRouter;
};

export default purposeRouter;
