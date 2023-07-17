import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ExpressContext, ZodiosContext } from "../app.js";
import { api } from "../model/generated/api.js";
import { ApiError, makeApiError } from "../model/types.js";
import { catalogService } from "../services/CatalogService.js";
import { readModelGateway } from "../services/ReadModelGateway.js";
import { convertCatalogToEService } from "../model/domain/models.js";
import { logger } from "../utilities/logger.js";
import {
  eServiceDocumentNotFound,
  eServiceNotFound,
} from "../model/domain/errors.js";

const eservicesRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const eservicesRouter = ctx.router(api.api);

  eservicesRouter
    .get("/eservices", async (req, res) => {
      try {
        const {
          name,
          eservicesIds,
          producersIds,
          states,
          agreementStates,
          offset,
          limit,
        } = req.query;

        const catalogs = await readModelGateway.getEServices(
          req.authData,
          eservicesIds,
          producersIds,
          states,
          agreementStates,
          offset,
          limit,
          name ? { value: name, exactMatch: false } : undefined
        );

        return res
          .status(200)
          .json({
            results: catalogs.map(convertCatalogToEService),
            totalCount: catalogs.length,
          })
          .end();
      } catch (error) {
        return res.status(500).end();
      }
    })
    .post("/eservices", async (req, res) => {
      try {
        const id = await catalogService.createEService(
          req.body,
          req.ctx.authData
        );
        return res.status(201).json({ id }).end();
      } catch (error) {
        const errorRes: ApiError = makeApiError(error);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get("/eservices/:eServiceId", async (req, res) => {
      try {
        const catalog = await readModelGateway.getEServiceById(
          req.params.eServiceId
        );

        if (catalog) {
          return res.status(200).json(convertCatalogToEService(catalog)).end();
        } else {
          return res
            .status(404)
            .json(makeApiError(eServiceNotFound(req.params.eServiceId)))
            .end();
        }
      } catch (error) {
        const errorRes: ApiError = makeApiError(error);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .put("/eservices/:eServiceId", async (req, res) => {
      try {
        await catalogService.updateEService(
          req.params.eServiceId,
          req.body,
          req.ctx.authData
        );
        return res.status(200).end();
      } catch (error) {
        const errorRes: ApiError = makeApiError(error);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .delete("/eservices/:eServiceId", async (req, res) => {
      try {
        await catalogService.deleteEService(
          req.params.eServiceId,
          req.ctx.authData
        );
        return res.status(204).end();
      } catch (error) {
        const errorRes: ApiError = makeApiError(error);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get("/eservices/:eServiceId/consumers", async (req, res) => {
      try {
        const eServiceId = req.params.eServiceId;
        const offset = req.query.offset;
        const limit = req.query.limit;

        const consumers = await readModelGateway.getEServiceConsumers(
          eServiceId,
          offset,
          limit
        );

        logger.info(consumers);

        return res.status(200).end();
      } catch (error) {
        const errorRes: ApiError = makeApiError(error);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      async (req, res) => {
        try {
          const { eServiceId, descriptorId, documentId } = req.params;

          const document = await readModelGateway.getDocumentById(
            eServiceId,
            descriptorId,
            documentId
          );

          if (document) {
            return res
              .status(200)
              .json({
                id: document.id,
                name: document.name,
                contentType: document.contentType,
                prettyName: document.prettyName,
                path: document.path,
              })
              .end();
          } else {
            return res
              .status(404)
              .json(
                makeApiError(
                  eServiceDocumentNotFound(eServiceId, descriptorId, documentId)
                )
              )
              .end();
          }
        } catch (error) {
          const errorRes: ApiError = makeApiError(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents",
      async (req, res) => {
        try {
          const id = await catalogService.uploadDocument(
            req.params.eServiceId,
            req.params.descriptorId,
            req.body,
            req.ctx.authData
          );
          return res.status(200).json({ id }).end();
        } catch (error) {
          const errorRes: ApiError = makeApiError(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      async (req, res) => {
        try {
          await catalogService.deleteDocument(
            req.params.eServiceId,
            req.params.descriptorId,
            req.params.documentId,
            req.ctx.authData
          );
          return res.status(204).end();
        } catch (error) {
          const errorRes: ApiError = makeApiError(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update",
      async (req, res) => {
        try {
          await catalogService.updateDocument(
            req.params.eServiceId,
            req.params.descriptorId,
            req.params.documentId,
            req.body,
            req.ctx.authData
          );
          return res.status(200).end();
        } catch (error) {
          const errorRes: ApiError = makeApiError(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post("/eservices/:eServiceId/descriptors", async (req, res) => {
      try {
        const id = await catalogService.createDescriptor(
          req.params.eServiceId,
          req.body,
          req.ctx.authData
        );
        return res.status(200).json({ id }).end();
      } catch (error) {
        const errorRes: ApiError = makeApiError(error);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      async (req, res) => {
        try {
          await catalogService.deleteDraftDescriptor(
            req.params.eServiceId,
            req.params.descriptorId,
            req.ctx.authData
          );
          return res.status(204).end();
        } catch (error) {
          const errorRes: ApiError = makeApiError(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .put(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      async (req, res) => {
        try {
          await catalogService.updateDescriptor(
            req.params.eServiceId,
            req.params.descriptorId,
            req.body,
            req.ctx.authData
          );
          return res.status(200).end();
        } catch (error) {
          const errorRes: ApiError = makeApiError(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    );

  return eservicesRouter;
};
export default eservicesRouter;
