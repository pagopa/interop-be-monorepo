import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  fromAppContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { unsafeBrandId } from "pagopa-interop-models";
import { api } from "../model/generated/api.js";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { purposeServiceBuilder } from "../services/purposeService.js";
import { makeApiProblem } from "../model/domain/errors.js";
import { reversePurposeUpdateErrorMapper } from "../utilities/errorMappers.js";

const purposeRouter = (
  ctx: ZodiosContext,
  { purposeProcessClient }: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const purposeRouter = ctx.router(api.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const purposeService = purposeServiceBuilder(purposeProcessClient);

  purposeRouter
    .post("/reverse/purposes", async (_req, res) => res.status(501).send())
    .post("/reverse/purposes/:purposeId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      const requestHeaders = {
        "X-Correlation-Id": ctx.correlationId,
        Authorization: req.headers.authorization as string,
      };

      try {
        const result = await purposeService.reversePurposeUpdate(
          unsafeBrandId(req.params.purposeId),
          req.body,
          ctx,
          requestHeaders
        );

        return res.status(200).json(result).end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          reversePurposeUpdateErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
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
