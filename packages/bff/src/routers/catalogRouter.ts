/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { constants } from "http2";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  FileManager,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { unsafeBrandId } from "pagopa-interop-models";
import { toEserviceCatalogProcessQueryParams } from "../model/api/apiConverter.js";
import { makeApiProblem } from "../model/domain/errors.js";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { catalogServiceBuilder } from "../services/catalogService.js";
import { fromBffAppContext } from "../utilities/context.js";
import {
  bffGetCatalogErrorMapper,
  emptyErrorMapper,
} from "../utilities/errorMappers.js";

const catalogRouter = (
  ctx: ZodiosContext,
  {
    catalogProcessClient,
    tenantProcessClient,
    agreementProcessClient,
  }: PagoPAInteropBeClients,
  fileManager: FileManager
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const catalogRouter = ctx.router(bffApi.eservicesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const catalogService = catalogServiceBuilder(
    catalogProcessClient,
    tenantProcessClient,
    agreementProcessClient,
    fileManager
  );

  catalogRouter
    .get("/catalog", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      const queryParams = toEserviceCatalogProcessQueryParams(req.query);
      try {
        const response = await catalogService.getCatalog(ctx, queryParams);

        return res.status(200).json(response).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          bffGetCatalogErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
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
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          const { contentType, document } =
            await catalogService.getEServiceDocumentById(
              unsafeBrandId(req.params.eServiceId),
              unsafeBrandId(req.params.descriptorId),
              unsafeBrandId(req.params.documentId),
              ctx
            );
          return res
            .header(constants.HTTP2_HEADER_CONTENT_TYPE, contentType)
            .status(200)
            .end(document);
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
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
    .post("/eservices/:eServiceId/update", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const id = await catalogService.updateEServiceDescription(
          ctx.headers,
          unsafeBrandId(req.params.eServiceId),
          req.body
        );
        return res.status(200).json(id).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
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
