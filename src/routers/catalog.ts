import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { Response } from "express";
import { ExpressContext, ZodiosContext } from "../app.js";
import { api } from "../model/generated/api.js";
import { ApiError, makeApiError } from "../model/types.js";
import { catalogService } from "../services/CatalogService.js";

async function handler(
  res: Response,
  handler: () => Promise<{ status: number; data?: unknown }>
): Promise<Response<unknown, Record<string, unknown>>> {
  try {
    const { status, data } = await handler();
    return res.status(status).json(data).end();
  } catch (error) {
    const errorRes: ApiError = makeApiError(error);
    return res.status(errorRes.status).json(errorRes).end();
  }
}

const eservicesRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const eservicesRouter = ctx.router(api.api);

  eservicesRouter
    .post("/eservices", async (req, res) =>
      handler(res, async () => {
        await catalogService.createEService(req.body, req.authData);
        return { status: 201 };
      })
    )
    .put("/eservices/:eServiceId", async (req, res) =>
      handler(res, async () => {
        await catalogService.updateEService(
          req.params.eServiceId,
          req.body,
          req.authData
        );
        return { status: 200 };
      })
    )
    .delete("/eservices/:eServiceId", async (req, res) =>
      handler(res, async () => {
        await catalogService.deleteEService(
          req.params.eServiceId,
          req.authData
        );
        return { status: 204 };
      })
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents",
      async (req, res) =>
        handler(res, async () => {
          await catalogService.uploadDocument(
            req.params.eServiceId,
            req.params.descriptorId,
            req.body,
            req.authData
          );
          return { status: 200 };
        })
    )
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      async (req, res) =>
        handler(res, async () => {
          await catalogService.deleteDocument(
            req.params.eServiceId,
            req.params.descriptorId,
            req.params.documentId,
            req.authData
          );
          return { status: 204 };
        })
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update",
      async (req, res) =>
        handler(res, async () => {
          await catalogService.updateDocument(
            req.params.eServiceId,
            req.params.descriptorId,
            req.params.documentId,
            req.body,
            req.authData
          );
          return { status: 200 };
        })
    );

  return eservicesRouter;
};
export default eservicesRouter;
