import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ExpressContext, ZodiosContext } from "../app.js";
import { api } from "../model/generated/api.js";
import { ApiError, makeApiError } from "../model/types.js";
import { catalogService } from "../services/catalogService.js";
import { readModelService } from "../services/readModelService.js";
import {
  agreementStateToApiAgreementState,
  apiAgreementStateToAgreementState,
  apiDescriptorStateToDescriptorState,
  descriptorStateToApiEServiceDescriptorState,
  eServiceToApiEService,
} from "../model/domain/apiConverter.js";
import {
  eServiceDocumentNotFound,
  eServiceNotFound,
} from "../model/domain/errors.js";
import {
  ApiAgreementState,
  ApiEServiceDescriptorState,
  Consumer,
} from "../model/domain/models.js";

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

        const catalogs = await readModelService.getEServices(
          req.ctx.authData,
          {
            eservicesIds,
            producersIds,
            states: states.map(apiDescriptorStateToDescriptorState),
            agreementStates: agreementStates.map(
              apiAgreementStateToAgreementState
            ),
            name: name ? { value: name, exactMatch: false } : undefined,
          },
          offset,
          limit
        );

        return res
          .status(200)
          .json({
            results: catalogs.results.map(eServiceToApiEService),
            totalCount: catalogs.totalCount,
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
        const eService = await readModelService.getEServiceById(
          req.params.eServiceId
        );

        if (eService) {
          return res
            .status(200)
            .json(eServiceToApiEService(eService.data))
            .end();
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

        const consumers = await readModelService.getEServiceConsumers(
          eServiceId,
          offset,
          limit
        );

        // TODO : fix returnn types and remove this filtering
        const validConsumers = consumers.results.reduce(
          (
            acc: Array<{
              descriptorVersion: number;
              descriptorState: ApiEServiceDescriptorState;
              agreementState: ApiAgreementState;
              consumerName: string;
              consumerExternalId: string;
            }>,
            c: Consumer
          ) => {
            if (
              c.descriptorVersion !== undefined &&
              c.consumerName !== undefined &&
              c.consumerExternalId !== undefined
            ) {
              return [
                ...acc,
                {
                  descriptorVersion: parseInt(c.descriptorVersion, 10),
                  descriptorState: descriptorStateToApiEServiceDescriptorState(
                    c.descriptorState
                  ),
                  agreementState: agreementStateToApiAgreementState(
                    c.agreementState
                  ),
                  consumerName: c.consumerName,
                  consumerExternalId: c.consumerExternalId,
                },
              ];
            }

            return acc;
          },
          []
        );

        return res
          .status(200)
          .json({
            results: validConsumers,
            totalCount: consumers.totalCount,
          })
          .end();
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

          const document = await readModelService.getDocumentById(
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
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/publish",
      async (req, res) => {
        try {
          await catalogService.publishDescriptor(
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
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/suspend",
      async (req, res) => {
        try {
          await catalogService.suspendDescriptor(
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
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/activate",
      async (req, res) => {
        try {
          await catalogService.activateDescriptor(
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
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/clone",
      async (req, res) => {
        try {
          const clonedEserviceByDescriptor =
            await catalogService.cloneDescriptor(
              req.params.eServiceId,
              req.params.descriptorId,
              req.ctx.authData
            );
          return res.status(200).json(clonedEserviceByDescriptor).end();
        } catch (error) {
          const errorRes: ApiError = makeApiError(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/archive",
      async (req, res) => {
        try {
          await catalogService.archiveDescriptor(
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
    );
  return eservicesRouter;
};
export default eservicesRouter;
