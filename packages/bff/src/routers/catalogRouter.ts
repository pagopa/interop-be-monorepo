/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  FileManager,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import {
  DescriptorId,
  EServiceDocumentId,
  EServiceId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { toEserviceCatalogProcessQueryParams } from "../model/api/converters/catalogClientApiConverter.js";
import { makeApiProblem } from "../model/domain/errors.js";
import { catalogServiceBuilder } from "../services/catalogService.js";
import { fromBffAppContext } from "../utilities/context.js";
import {
  bffGetCatalogErrorMapper,
  emptyErrorMapper,
} from "../utilities/errorMappers.js";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";

const catalogRouter = (
  ctx: ZodiosContext,
  {
    catalogProcessClient,
    tenantProcessClient,
    agreementProcessClient,
    attributeProcessClient,
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
    attributeProcessClient,
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
          ctx.logger,
          "Error retrieving Catalog EServices"
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get("/producers/eservices", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const response = await catalogService.getProducerEServices(
          req.query.q,
          req.query.consumersIds,
          req.query.offset,
          req.query.limit,
          ctx
        );

        return res.status(200).json(response).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          bffGetCatalogErrorMapper,
          ctx.logger,
          "Error retrieving Producer EServices"
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get("/producers/eservices/:eserviceId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const response = await catalogService.getProducerEServiceDetails(
          req.params.eserviceId,
          ctx
        );
        return res.status(200).json(response).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          bffGetCatalogErrorMapper,
          ctx.logger,
          `Error retrieving producer eservice ${req.params.eserviceId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get(
      "/producers/eservices/:eserviceId/descriptors/:descriptorId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        try {
          const response = await catalogService.getProducerEServiceDescriptor(
            unsafeBrandId(req.params.eserviceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          return res.status(200).json(response).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            bffGetCatalogErrorMapper,
            ctx.logger,
            `Error retrieving producer descriptor ${req.params.descriptorId} for eservice ${req.params.eserviceId}`
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/catalog/eservices/:eserviceId/descriptor/:descriptorId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          const response = await catalogService.getCatalogEServiceDescriptor(
            unsafeBrandId(req.params.eserviceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );

          return res.status(200).json(response).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            bffGetCatalogErrorMapper,
            ctx.logger,
            `Error retrieving descriptor ${req.params.descriptorId} of eservice ${req.params.eserviceId} from catalog`
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post("/eservices", async (_req, res) => res.status(501).send())
    .get("/eservices/:eServiceId/consumers", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const response = await catalogService.getEServiceConsumers(
          unsafeBrandId(req.params.eServiceId),
          ctx
        );

        return res
          .header(
            "Content-Disposition",
            `attachment; filename=${response.filename}`
          )
          .header("Content-Type", "application/octet-stream")
          .send(response.file);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          bffGetCatalogErrorMapper,
          ctx.logger,
          `Error getting consumers of eservice ${req.params.eServiceId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          await catalogService.deleteDraft(
            req.params.eServiceId,
            req.body,
            ctx
          );
          return res.status(204).json().send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .put(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          const createdResource = await catalogService.updateDraftDescriptor(
            req.params.eServiceId,
            req.params.descriptorId,
            req.body,
            ctx
          );
          return res.status(200).json(createdResource).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post("/eservices/:eServiceId/descriptors", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const createdResource = await catalogService.createDescriptor(
          req.params.eServiceId,
          ctx
        );
        return res.status(200).json(createdResource).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/activate",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          await catalogService.activateDescriptor(
            unsafeBrandId(req.params.eServiceId),
            req.params.descriptorId,
            ctx
          );
          return res.status(204).json().send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/update",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          const { id } = await catalogService.updateDescriptor(
            unsafeBrandId(req.params.eServiceId),
            req.params.descriptorId,
            req.body,
            ctx
          );
          return res.status(200).json().send({ id });
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/publish",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          await catalogService.publishDescriptor(
            unsafeBrandId(req.params.eServiceId),
            req.params.descriptorId,
            ctx
          );
          return res.status(204).json().send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/suspend",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          await catalogService.suspendDescriptor(
            unsafeBrandId(req.params.eServiceId),
            req.params.descriptorId,
            ctx
          );
          return res.status(204).json().send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          const resp = await catalogService.createEServiceDocument(
            req.params.eServiceId,
            req.params.descriptorId,
            req.body,
            ctx
          );
          return res.status(200).json(resp).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          await catalogService.deleteEServiceDocumentById(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            unsafeBrandId(req.params.documentId),
            ctx
          );
          return res.status(204).json().send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/clone",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          const createdEServiceDescriptor =
            await catalogService.cloneEServiceByDescriptor(
              unsafeBrandId(req.params.eServiceId),
              unsafeBrandId(req.params.descriptorId),
              ctx
            );
          return res.status(200).json(createdEServiceDescriptor).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);

        const eServiceId = unsafeBrandId<EServiceId>(req.params.eServiceId);
        const descriptorId = unsafeBrandId<DescriptorId>(
          req.params.descriptorId
        );
        const documentId = unsafeBrandId<EServiceDocumentId>(
          req.params.documentId
        );

        try {
          const doc = await catalogService.updateEServiceDocumentById(
            eServiceId,
            descriptorId,
            documentId,
            req.body,
            ctx
          );

          return res.status(200).json(doc).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            bffGetCatalogErrorMapper,
            ctx.logger,
            `Error updating document ${documentId} on eService ${eServiceId} for descriptor ${descriptorId}`
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete("/eservices/:eServiceId", async (_req, res) =>
      res.status(501).send()
    )
    .put("/eservices/:eServiceId", async (_req, res) => res.status(501).send())
    .post("/eservices/:eServiceId/riskAnalysis", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await catalogService.addRiskAnalysisToEService(
          unsafeBrandId(req.params.eServiceId),
          req.body,
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          bffGetCatalogErrorMapper,
          ctx.logger,
          `Error inserting risk analysis ${req.body.name} to eservice ${req.params.eServiceId} from catalog`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .post("/eservices/:eServiceId/update", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const id = await catalogService.updateEServiceDescription(
          ctx,
          unsafeBrandId(req.params.eServiceId),
          req.body
        );
        return res.status(200).json(id).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          `Error updating description of eservice with Id: ${req.params.eServiceId}`
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get(
      "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          const riskAnalysis = await catalogService.getEServiceRiskAnalysis(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.riskAnalysisId),
            ctx
          );

          return res.status(200).json(riskAnalysis).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            bffGetCatalogErrorMapper,
            ctx.logger,
            `Error retrieving risk analysis ${req.params.riskAnalysisId} to eservice ${req.params.eServiceId} from catalog`
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          await catalogService.updateEServiceRiskAnalysis(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.riskAnalysisId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            bffGetCatalogErrorMapper,
            ctx.logger,
            `Error updating risk analysis ${req.params.riskAnalysisId} to eservice ${req.params.eServiceId} from catalog`
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete(
      "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          await catalogService.deleteEServiceRiskAnalysis(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.riskAnalysisId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            bffGetCatalogErrorMapper,
            ctx.logger,
            `Error deleting risk analysis ${req.params.riskAnalysisId} to eservice ${req.params.eServiceId} from catalog`
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/export/eservices/:eserviceId/descriptors/:descriptorId",
      async (_req, res) => res.status(501).send()
    )
    .get("/import/eservices/presignedUrl", async (_req, res) =>
      res.status(501).send()
    )
    .post("/import/eservices", async (_req, res) => res.status(501).send());

  return catalogRouter;
};

export default catalogRouter;
