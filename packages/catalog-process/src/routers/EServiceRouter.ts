import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { eServiceNotFound, makeApiProblem } from "pagopa-interop-models";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
} from "pagopa-interop-commons";
import {
  agreementStateToApiAgreementState,
  apiAgreementStateToAgreementState,
  apiDescriptorStateToDescriptorState,
  descriptorStateToApiEServiceDescriptorState,
  eServiceToApiEService,
} from "../model/domain/apiConverter.js";
import { api } from "../model/generated/api.js";
import { catalogService } from "../services/catalogService.js";
import { readModelService } from "../services/readModelService.js";
import { eServiceDocumentNotFound } from "../model/domain/errors.js";

const eservicesRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const eservicesRouter = ctx.router(api.api);
  const {
    ADMIN_ROLE,
    SECURITY_ROLE,
    API_ROLE,
    M2M_ROLE,
    INTERNAL_ROLE,
    SUPPORT_ROLE,
  } = userRoles;
  eservicesRouter
    .get(
      "/eservices",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
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
      }
    )
    .post(
      "/eservices",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        try {
          const id = await catalogService.createEService(
            req.body,
            req.ctx.authData
          );
          return res.status(201).json({ id }).end();
        } catch (error) {
          const errorRes = makeApiProblem(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/eservices/:eServiceId",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
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
              .json(makeApiProblem(eServiceNotFound(req.params.eServiceId)))
              .end();
          }
        } catch (error) {
          const errorRes = makeApiProblem(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .put(
      "/eservices/:eServiceId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        try {
          await catalogService.updateEService(
            req.params.eServiceId,
            req.body,
            req.ctx.authData
          );
          return res.status(200).end();
        } catch (error) {
          const errorRes = makeApiProblem(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete(
      "/eservices/:eServiceId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        try {
          await catalogService.deleteEService(
            req.params.eServiceId,
            req.ctx.authData
          );
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/eservices/:eServiceId/consumers",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        try {
          const eServiceId = req.params.eServiceId;
          const offset = req.query.offset;
          const limit = req.query.limit;

          const consumers = await readModelService.getEServiceConsumers(
            eServiceId,
            offset,
            limit
          );

          return res
            .status(200)
            .json({
              results: consumers.results.map((c) => ({
                descriptorVersion: parseInt(c.descriptorVersion, 10),
                descriptorState: descriptorStateToApiEServiceDescriptorState(
                  c.descriptorState
                ),
                agreementState: agreementStateToApiAgreementState(
                  c.agreementState
                ),
                consumerName: c.consumerName,
                consumerExternalId: c.consumerExternalId,
              })),
              totalCount: consumers.totalCount,
            })
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
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
                makeApiProblem(
                  eServiceDocumentNotFound(eServiceId, descriptorId, documentId)
                )
              )
              .end();
          }
        } catch (error) {
          const errorRes = makeApiProblem(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
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
          const errorRes = makeApiProblem(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
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
          const errorRes = makeApiProblem(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
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
          const errorRes = makeApiProblem(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        try {
          const id = await catalogService.createDescriptor(
            req.params.eServiceId,
            req.body,
            req.ctx.authData
          );
          return res.status(200).json({ id }).end();
        } catch (error) {
          const errorRes = makeApiProblem(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        try {
          await catalogService.deleteDraftDescriptor(
            req.params.eServiceId,
            req.params.descriptorId,
            req.ctx.authData
          );
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .put(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
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
          const errorRes = makeApiProblem(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/publish",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        try {
          await catalogService.publishDescriptor(
            req.params.eServiceId,
            req.params.descriptorId,
            req.ctx.authData
          );
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/suspend",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        try {
          await catalogService.suspendDescriptor(
            req.params.eServiceId,
            req.params.descriptorId,
            req.ctx.authData
          );
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/activate",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        try {
          await catalogService.activateDescriptor(
            req.params.eServiceId,
            req.params.descriptorId,
            req.ctx.authData
          );
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/clone",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
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
          const errorRes = makeApiProblem(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/archive",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        try {
          await catalogService.archiveDescriptor(
            req.params.eServiceId,
            req.params.descriptorId,
            req.ctx.authData
          );
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    );
  return eservicesRouter;
};
export default eservicesRouter;
