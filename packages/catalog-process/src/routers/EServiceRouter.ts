import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { Request, Response } from "express";
import {
  eServiceDocumentNotFound,
  eServiceNotFound,
} from "pagopa-interop-models";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authRoleMiddleware,
  hasValidRoles,
  UserRoles,
} from "pagopa-interop-commons";
import {
  agreementStateToApiAgreementState,
  apiAgreementStateToAgreementState,
  apiDescriptorStateToDescriptorState,
  descriptorStateToApiEServiceDescriptorState,
  eServiceToApiEService,
} from "../model/domain/apiConverter.js";
import { api } from "../model/generated/api.js";
import { ApiError, makeApiError } from "../model/types.js";
import { catalogService } from "../services/catalogService.js";
import { readModelService } from "../services/readModelService.js";

const roleValidation = (
  req: Request,
  res: Response,
  admittedRoles: UserRoles[]
): void => {
  // ------------------------------------------------
  // Temporary workaround authRoleMiddleware type signature doesn't support request with query params
  const roleValidation = hasValidRoles(req, admittedRoles);
  if (!roleValidation.isValid) {
    const errorRes: ApiError = makeApiError(roleValidation.error);
    res.status(errorRes.status).end();
  }
  // ------------------------------------------------
};
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
      // authRoleMiddleware([
      //   ADMIN_ROLE,
      //   API_ROLE,
      //   SECURITY_ROLE,
      //   M2M_ROLE,
      //   SUPPORT_ROLE,
      // ]),
      async (req, res) => {
        try {
          roleValidation(
            req as unknown as Request,
            res as unknown as Response,
            [ADMIN_ROLE, API_ROLE, SECURITY_ROLE, M2M_ROLE, SUPPORT_ROLE]
          );
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
      authRoleMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
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
      }
    )
    .get(
      "/eservices/:eServiceId",
      authRoleMiddleware([
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
              .json(makeApiError(eServiceNotFound(req.params.eServiceId)))
              .end();
          }
        } catch (error) {
          const errorRes: ApiError = makeApiError(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .put(
      "/eservices/:eServiceId",
      authRoleMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
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
      }
    )
    .delete(
      "/eservices/:eServiceId",
      authRoleMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
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
      }
    )
    .get(
      "/eservices/:eServiceId/consumers",
      // authRoleMiddleware([
      //   ADMIN_ROLE,
      //   API_ROLE,
      //   SECURITY_ROLE,
      //   M2M_ROLE,
      //   SUPPORT_ROLE,
      // ]),
      async (req, res) => {
        try {
          roleValidation(
            req as unknown as Request,
            res as unknown as Response,
            [ADMIN_ROLE, API_ROLE, SECURITY_ROLE, M2M_ROLE, SUPPORT_ROLE]
          );
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
          const errorRes: ApiError = makeApiError(error);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      authRoleMiddleware([ADMIN_ROLE, API_ROLE]),
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
      authRoleMiddleware([ADMIN_ROLE, API_ROLE]),
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
      authRoleMiddleware([ADMIN_ROLE, API_ROLE]),
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
      authRoleMiddleware([ADMIN_ROLE, API_ROLE]),
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
    .post(
      "/eservices/:eServiceId/descriptors",
      authRoleMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
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
      }
    )
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      authRoleMiddleware([ADMIN_ROLE, API_ROLE]),
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
      authRoleMiddleware([ADMIN_ROLE, API_ROLE]),
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
      authRoleMiddleware([ADMIN_ROLE, API_ROLE]),
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
      authRoleMiddleware([ADMIN_ROLE, API_ROLE]),
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
      authRoleMiddleware([ADMIN_ROLE, API_ROLE]),
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
      authRoleMiddleware([ADMIN_ROLE, API_ROLE]),
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
      authRoleMiddleware([INTERNAL_ROLE]),
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
