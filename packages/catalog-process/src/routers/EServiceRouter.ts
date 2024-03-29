import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
  ReadModelRepository,
  initDB,
  initFileManager,
} from "pagopa-interop-commons";
import {
  unsafeBrandId,
  EServiceId,
  TenantId,
  AttributeId,
} from "pagopa-interop-models";
import {
  agreementStateToApiAgreementState,
  apiAgreementStateToAgreementState,
  apiDescriptorStateToDescriptorState,
  apiEServiceModeToEServiceMode,
  descriptorStateToApiEServiceDescriptorState,
  descriptorToApiDescriptor,
  documentToApiDocument,
  eServiceToApiEService,
} from "../model/domain/apiConverter.js";
import { api } from "../model/generated/api.js";
import { config } from "../utilities/config.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { catalogServiceBuilder } from "../services/catalogService.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  activateDescriptorErrorMapper,
  archiveDescriptorErrorMapper,
  cloneEServiceByDescriptorErrorMapper,
  createDescriptorErrorMapper,
  createEServiceErrorMapper,
  createRiskAnalysisErrorMapper,
  deleteDraftDescriptorErrorMapper,
  deleteEServiceErrorMapper,
  deleteRiskAnalysisErrorMapper,
  documentCreateErrorMapper,
  documentGetErrorMapper,
  documentUpdateDeleteErrorMapper,
  getEServiceErrorMapper,
  publishDescriptorErrorMapper,
  suspendDescriptorErrorMapper,
  updateDescriptorErrorMapper,
  updateDraftDescriptorErrorMapper,
  updateEServiceErrorMapper,
  updateRiskAnalysisErrorMapper,
} from "../utilities/errorMappers.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);

const catalogService = catalogServiceBuilder(
  initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  }),
  readModelService,
  initFileManager(config)
);

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
            attributesIds,
            states,
            agreementStates,
            mode,
            offset,
            limit,
          } = req.query;

          const catalogs = await catalogService.getEServices(
            req.ctx.authData,
            {
              eservicesIds: eservicesIds.map<EServiceId>(unsafeBrandId),
              producersIds: producersIds.map<TenantId>(unsafeBrandId),
              attributesIds: attributesIds.map<AttributeId>(unsafeBrandId),
              states: states.map(apiDescriptorStateToDescriptorState),
              agreementStates: agreementStates.map(
                apiAgreementStateToAgreementState
              ),
              name,
              mode: mode ? apiEServiceModeToEServiceMode(mode) : undefined,
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
          const eservice = await catalogService.createEService(
            req.body,
            req.ctx.authData,
            req.ctx.correlationId
          );
          return res.status(200).json(eServiceToApiEService(eservice)).end();
        } catch (error) {
          const errorRes = makeApiProblem(error, createEServiceErrorMapper);
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
          const eservice = await catalogService.getEServiceById(
            unsafeBrandId(req.params.eServiceId),
            req.ctx.authData
          );
          return res.status(200).json(eServiceToApiEService(eservice)).end();
        } catch (error) {
          const errorRes = makeApiProblem(error, getEServiceErrorMapper);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .put(
      "/eservices/:eServiceId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        try {
          const updatedEService = await catalogService.updateEService(
            unsafeBrandId(req.params.eServiceId),
            req.body,
            req.ctx.authData,
            req.ctx.correlationId
          );
          return res
            .status(200)
            .json(eServiceToApiEService(updatedEService))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(error, updateEServiceErrorMapper);
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
            unsafeBrandId(req.params.eServiceId),
            req.ctx.authData,
            req.ctx.correlationId
          );
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(error, deleteEServiceErrorMapper);
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
          const consumers = await catalogService.getEServiceConsumers(
            unsafeBrandId(req.params.eServiceId),
            req.query.offset,
            req.query.limit
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
          const errorRes = makeApiProblem(error, () => 500);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        try {
          const { eServiceId, descriptorId, documentId } = req.params;

          const document = await catalogService.getDocumentById({
            eserviceId: unsafeBrandId(eServiceId),
            descriptorId: unsafeBrandId(descriptorId),
            documentId: unsafeBrandId(documentId),
            authData: req.ctx.authData,
          });

          return res.status(200).json(documentToApiDocument(document)).end();
        } catch (error) {
          const errorRes = makeApiProblem(error, documentGetErrorMapper);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        try {
          const updatedEService = await catalogService.uploadDocument(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.body,
            req.ctx.authData,
            req.ctx.correlationId
          );
          return res
            .status(200)
            .json(eServiceToApiEService(updatedEService))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(error, documentCreateErrorMapper);
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
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            unsafeBrandId(req.params.documentId),
            req.ctx.authData,
            req.ctx.correlationId
          );
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            documentUpdateDeleteErrorMapper
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        try {
          const updatedDocument = await catalogService.updateDocument(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            unsafeBrandId(req.params.documentId),
            req.body,
            req.ctx.authData,
            req.ctx.correlationId
          );
          return res
            .status(200)
            .json(documentToApiDocument(updatedDocument))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            documentUpdateDeleteErrorMapper
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        try {
          const descriptor = await catalogService.createDescriptor(
            unsafeBrandId(req.params.eServiceId),
            req.body,
            req.ctx.authData,
            req.ctx.correlationId
          );
          return res
            .status(200)
            .json(descriptorToApiDescriptor(descriptor))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(error, createDescriptorErrorMapper);
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
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.ctx.authData,
            req.ctx.correlationId
          );
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteDraftDescriptorErrorMapper
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .put(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        try {
          const updatedEService = await catalogService.updateDraftDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.body,
            req.ctx.authData,
            req.ctx.correlationId
          );
          return res
            .status(200)
            .json(eServiceToApiEService(updatedEService))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateDraftDescriptorErrorMapper
          );
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
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.ctx.authData,
            req.ctx.correlationId
          );
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(error, publishDescriptorErrorMapper);
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
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.ctx.authData,
            req.ctx.correlationId
          );
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(error, suspendDescriptorErrorMapper);
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
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.ctx.authData,
            req.ctx.correlationId
          );
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(error, activateDescriptorErrorMapper);
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
              unsafeBrandId(req.params.eServiceId),
              unsafeBrandId(req.params.descriptorId),
              req.ctx.authData,
              req.ctx.correlationId
            );
          return res
            .status(200)
            .json(eServiceToApiEService(clonedEserviceByDescriptor))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            cloneEServiceByDescriptorErrorMapper
          );
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
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.ctx.authData,
            req.ctx.correlationId
          );
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(error, archiveDescriptorErrorMapper);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/update",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        try {
          const updatedEService = await catalogService.updateDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.body,
            req.ctx.authData,
            req.ctx.correlationId
          );
          return res
            .status(200)
            .json(eServiceToApiEService(updatedEService))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(error, updateDescriptorErrorMapper);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/riskAnalysis",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),

      async (req, res) => {
        try {
          await catalogService.createRiskAnalysis(
            unsafeBrandId(req.params.eServiceId),
            req.body,
            req.ctx.authData,
            req.ctx.correlationId
          );
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(error, createRiskAnalysisErrorMapper);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),

      async (req, res) => {
        try {
          await catalogService.updateRiskAnalysis(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.riskAnalysisId),
            req.body,
            req.ctx.authData,
            req.ctx.correlationId
          );
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(error, updateRiskAnalysisErrorMapper);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete(
      "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),

      async (req, res) => {
        try {
          await catalogService.deleteRiskAnalysis(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.riskAnalysisId),
            req.ctx.authData,
            req.ctx.correlationId
          );
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(error, deleteRiskAnalysisErrorMapper);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    );
  return eservicesRouter;
};
export default eservicesRouter;
