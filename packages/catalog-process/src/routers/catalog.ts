import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { match } from "ts-pattern";
import { z } from "zod";
import { attribute } from "models";
import { ExpressContext, ZodiosContext } from "../app.js";
import { api } from "../model/generated/api.js";
import { ApiError, makeApiError } from "../model/types.js";
import { catalogService } from "../services/CatalogService.js";
import { readModelGateway } from "../services/ReadModelGateway.js";

const eservicesRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const eservicesRouter = ctx.router(api.api);

  eservicesRouter
    .get("/eservices", async (_, res) => {
      try {
        await readModelGateway.getEServiceById("1");

        // const eServices = await catalogService.getEServices(req.authData);
        return res.status(200).end();
      } catch (error) {
        return res.status(200).end();
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

        const mapAttribute = (a: z.infer<typeof attribute>) =>
          match(a)
            .with({ type: "SingleAttribute" }, (a) => ({
              single: a.id,
            }))
            .with({ type: "GroupAttribute" }, (a) => ({
              group: a.ids,
            }))
            .exhaustive();

        if (catalog) {
          return res
            .status(200)
            .json({
              ...catalog,
              descriptors: catalog.descriptors.map((descriptor) => ({
                ...descriptor,
                agreementApprovalPolicy:
                  descriptor.agreementApprovalPolicy ?? "AUTOMATIC",
                attributes: {
                  certified: descriptor.attributes.certified.map(mapAttribute),
                  declared: descriptor.attributes.declared.map(mapAttribute),
                  verified: descriptor.attributes.verified.map(mapAttribute),
                },
              })),
            })
            .end();
        } else {
          return res.status(404).end();
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
    .get("/eservices/:eServiceId/consumers", async (_, res) => {
      try {
        // const consumers = await catalogService.getConsumers(
        //   req.params.eServiceId,
        //   req.authData
        // );
        return res.status(200).end();
      } catch (error) {
        const errorRes: ApiError = makeApiError(error);
        return res.status(errorRes.status).json(errorRes).end();
      }
    })
    .get(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      async (_, res) => {
        try {
          // const document = await catalogService.getDocument(
          //   req.params.eServiceId,
          //   req.params.descriptorId,
          //   req.params.documentId,
          //   req.authData
          // );
          return res.status(200).end();
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
