import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { api } from "../model/generated/api.js";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";

const catalogRouter = (
  ctx: ZodiosContext,
  _: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const catalogRouter = ctx.router(api.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  catalogRouter
    .get("/catalog", async (_req, res) => res.status(501).send())
    .get("/producers/eservices", async (_req, res) => res.status(501).send())
    .get("/producers/eservices/:eserviceId", async (_req, res) =>
      res.status(501).send()
    )
    .get(
      "/producers/eservices/:eserviceId/descriptors/:descriptorId",
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/catalog/eservices/:eserviceId/descriptor/:descriptorId",
      async (_req, res) => res.status(501).send()
    )
    .post("/eservices", async (_req, res) => res.status(501).send())
    .get("/eservices/:eServiceId/consumers", async (_req, res) =>
      res.status(501).send()
    )
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      async (_req, res) => res.status(501).send()
    )
    .put(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      async (_req, res) => res.status(501).send()
    )
    .post("/eservices/:eServiceId/descriptors", async (_req, res) =>
      res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/activate",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/update",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/publish",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/suspend",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents",
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/clone",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update",
      async (_req, res) => res.status(501).send()
    )
    .delete("/eservices/:eServiceId", async (_req, res) =>
      res.status(501).send()
    )
    .put("/eservices/:eServiceId", async (_req, res) => res.status(501).send())
    .post("/eservices/:eServiceId/riskAnalysis", async (_req, res) =>
      res.status(501).send()
    )
    .get(
      "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      async (_req, res) => res.status(501).send()
    );

  return catalogRouter;
};

export default catalogRouter;
