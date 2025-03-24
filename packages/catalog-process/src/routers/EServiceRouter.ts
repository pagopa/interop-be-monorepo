import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { catalogApi } from "pagopa-interop-api-clients";
import {
  authorizationMiddleware,
  ExpressContext,
  fromAppContext,
  initDB,
  initFileManager,
  ReadModelRepository,
  userRoles,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import {
  AttributeId,
  EServiceId,
  EServiceTemplateId,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  attributeReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "../config/config.js";
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
import { makeApiProblem } from "../model/domain/errors.js";
import { catalogServiceBuilder } from "../services/catalogService.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import {
  activateDescriptorErrorMapper,
  addEServiceTemplateInstanceInterfaceErrorMapper,
  approveDelegatedEServiceDescriptorErrorMapper,
  archiveDescriptorErrorMapper,
  cloneEServiceByDescriptorErrorMapper,
  createDescriptorErrorMapper,
  createEServiceErrorMapper,
  createEServiceInstanceFromTemplateErrorMapper,
  createRiskAnalysisErrorMapper,
  createTemplateInstanceDescriptorDocumentErrorMapper,
  deleteDraftDescriptorErrorMapper,
  deleteEServiceErrorMapper,
  deleteRiskAnalysisErrorMapper,
  deleteTemplateInstanceDescriptorDocumentErrorMapper,
  documentCreateErrorMapper,
  documentDeleteErrorMapper,
  documentGetErrorMapper,
  documentUpdateErrorMapper,
  getEServiceErrorMapper,
  publishDescriptorErrorMapper,
  rejectDelegatedEServiceDescriptorErrorMapper,
  suspendDescriptorErrorMapper,
  updateDescriptorAttributesErrorMapper,
  updateDescriptorErrorMapper,
  updateDraftDescriptorErrorMapper,
  updateEServiceDescriptionErrorMapper,
  updateEServiceErrorMapper,
  updateEServiceFlagsErrorMapper,
  updateEServiceNameErrorMapper,
  updateRiskAnalysisErrorMapper,
  updateTemplateInstanceDescriptionErrorMapper,
  updateTemplateInstanceDescriptorAttributesErrorMapper,
  updateTemplateInstanceDescriptorDocumentErrorMapper,
  updateTemplateInstanceDescriptorVoucherLifespanErrorMapper,
  updateTemplateInstanceNameErrorMapper,
  upgradeEServiceInstanceErrorMapper,
  updateEServiceTemplateInstanceErrorMapper,
  updateDraftDescriptorTemplateInstanceErrorMapper,
  createTemplateInstanceDescriptorErrorMapper,
} from "../utilities/errorMappers.js";
import { readModelServiceBuilderSQL } from "../services/readModelServiceSQL.js";

const db = makeDrizzleConnection(config);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(db);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(db);
const templateReadModelServiceSQL = eserviceTemplateReadModelServiceBuilder(db);

const readModelRepository = ReadModelRepository.init(config);

const oldReadModelService = readModelServiceBuilder(readModelRepository);
const readModelServiceSQL = readModelServiceBuilderSQL(
  db,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  templateReadModelServiceSQL
);

const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

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
  const eservicesRouter = ctx.router(catalogApi.processApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
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
        const { logger } = fromAppContext(req.ctx);

        try {
          const {
            name,
            eservicesIds,
            producersIds,
            attributesIds,
            states,
            agreementStates,
            mode,
            delegated,
            isConsumerDelegable,
            templatesIds,
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
              isConsumerDelegable,
              delegated,
              templatesIds: templatesIds.map<EServiceTemplateId>(unsafeBrandId),
            },
            offset,
            limit,
            logger
          );

          return res.status(200).send(
            catalogApi.EServices.parse({
              results: catalogs.results.map(eServiceToApiEService),
              totalCount: catalogs.totalCount,
            })
          );
        } catch (error) {
          return res.status(500).send();
        }
      }
    )
    .post(
      "/eservices",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const eservice = await catalogService.createEService(req.body, ctx);
          return res
            .status(200)
            .send(catalogApi.EService.parse(eServiceToApiEService(eservice)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createEServiceErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/:templateId/eservices",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const eService =
            await catalogService.createEServiceInstanceFromTemplate(
              unsafeBrandId(req.params.templateId),
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(catalogApi.EService.parse(eServiceToApiEService(eService)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createEServiceInstanceFromTemplateErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
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
        INTERNAL_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const eservice = await catalogService.getEServiceById(
            unsafeBrandId(req.params.eServiceId),
            ctx
          );
          return res
            .status(200)
            .send(catalogApi.EService.parse(eServiceToApiEService(eservice)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getEServiceErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .put(
      "/eservices/:eServiceId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const updatedEService = await catalogService.updateEService(
            unsafeBrandId(req.params.eServiceId),
            req.body,
            ctx
          );
          return res
            .status(200)
            .send(
              catalogApi.EService.parse(eServiceToApiEService(updatedEService))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateEServiceErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/eservices/:eServiceId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const updatedEService =
            await catalogService.updateEServiceTemplateInstance(
              unsafeBrandId(req.params.eServiceId),
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(
              catalogApi.EService.parse(eServiceToApiEService(updatedEService))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateEServiceTemplateInstanceErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/eservices/:eServiceId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.deleteEService(
            unsafeBrandId(req.params.eServiceId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteEServiceErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
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
        const ctx = fromAppContext(req.ctx);

        try {
          const consumers = await catalogService.getEServiceConsumers(
            unsafeBrandId(req.params.eServiceId),
            req.query.offset,
            req.query.limit,
            ctx.logger
          );

          return res.status(200).send(
            catalogApi.EServiceConsumers.parse({
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
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            () => 500,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
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
        const ctx = fromAppContext(req.ctx);

        try {
          const { eServiceId, descriptorId, documentId } = req.params;

          const document = await catalogService.getDocumentById(
            {
              eserviceId: unsafeBrandId(eServiceId),
              descriptorId: unsafeBrandId(descriptorId),
              documentId: unsafeBrandId(documentId),
            },
            ctx
          );

          return res
            .status(200)
            .send(
              catalogApi.EServiceDoc.parse(documentToApiDocument(document))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            documentGetErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const updatedEService = await catalogService.uploadDocument(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.body,
            ctx
          );
          return res
            .status(200)
            .send(
              catalogApi.EService.parse(eServiceToApiEService(updatedEService))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            documentCreateErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.deleteDocument(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            unsafeBrandId(req.params.documentId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            documentDeleteErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const updatedDocument = await catalogService.updateDocument(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            unsafeBrandId(req.params.documentId),
            req.body,
            ctx
          );
          return res
            .status(200)
            .send(
              catalogApi.EServiceDoc.parse(
                documentToApiDocument(updatedDocument)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            documentUpdateErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const descriptor = await catalogService.createDescriptor(
            unsafeBrandId(req.params.eServiceId),
            req.body,
            ctx
          );
          return res
            .status(200)
            .send(
              catalogApi.EServiceDescriptor.parse(
                descriptorToApiDescriptor(descriptor)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.deleteDraftDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteDraftDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .put(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const updatedEService = await catalogService.updateDraftDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.body,
            ctx
          );
          return res
            .status(200)
            .send(
              catalogApi.EService.parse(eServiceToApiEService(updatedEService))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateDraftDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/eservices/:eServiceId/descriptors/:descriptorId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const updatedEService =
            await catalogService.updateDraftDescriptorTemplateInstance(
              unsafeBrandId(req.params.eServiceId),
              unsafeBrandId(req.params.descriptorId),
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(
              catalogApi.EService.parse(eServiceToApiEService(updatedEService))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateDraftDescriptorTemplateInstanceErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/publish",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.publishDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            publishDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/suspend",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.suspendDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            suspendDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/activate",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.activateDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            activateDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/clone",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const clonedEserviceByDescriptor =
            await catalogService.cloneDescriptor(
              unsafeBrandId(req.params.eServiceId),
              unsafeBrandId(req.params.descriptorId),
              ctx
            );
          return res
            .status(200)
            .send(
              catalogApi.EService.parse(
                eServiceToApiEService(clonedEserviceByDescriptor)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            cloneEServiceByDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/archive",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.archiveDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            archiveDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/update",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const updatedEService = await catalogService.updateDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.body,
            ctx
          );
          return res
            .status(200)
            .send(
              catalogApi.EService.parse(eServiceToApiEService(updatedEService))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/riskAnalysis",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.createRiskAnalysis(
            unsafeBrandId(req.params.eServiceId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createRiskAnalysisErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.updateRiskAnalysis(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.riskAnalysisId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateRiskAnalysisErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/description/update",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const updatedEService =
            await catalogService.updateEServiceDescription(
              unsafeBrandId(req.params.eServiceId),
              req.body.description,
              ctx
            );
          return res
            .status(200)
            .send(
              catalogApi.EService.parse(eServiceToApiEService(updatedEService))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateEServiceDescriptionErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/delegationFlags/update",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const updatedEService =
            await catalogService.updateEServiceDelegationFlags(
              unsafeBrandId(req.params.eServiceId),
              req.body,
              ctx
            );

          return res
            .status(200)
            .send(
              catalogApi.EService.parse(eServiceToApiEService(updatedEService))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateEServiceFlagsErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/name/update",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const updatedEService = await catalogService.updateEServiceName(
            unsafeBrandId(req.params.eServiceId),
            req.body.name,
            ctx
          );

          return res
            .status(200)
            .send(
              catalogApi.EService.parse(eServiceToApiEService(updatedEService))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateEServiceNameErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.deleteRiskAnalysis(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.riskAnalysisId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteRiskAnalysisErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/approve",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.approveDelegatedEServiceDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            approveDelegatedEServiceDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/reject",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.rejectDelegatedEServiceDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            rejectDelegatedEServiceDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/attributes/update",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const updatedEService =
            await catalogService.updateDescriptorAttributes(
              unsafeBrandId(req.params.eServiceId),
              unsafeBrandId(req.params.descriptorId),
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(
              catalogApi.EService.parse(eServiceToApiEService(updatedEService))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateDescriptorAttributesErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/eservices/:eServiceId/upgrade",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const descriptor = await catalogService.upgradeEServiceInstance(
            unsafeBrandId(req.params.eServiceId),
            ctx
          );
          return res
            .status(200)
            .send(
              catalogApi.EServiceDescriptor.parse(
                descriptorToApiDescriptor(descriptor)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            upgradeEServiceInstanceErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/internal/templates/eservices/:eServiceId/name/update",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.internalUpdateTemplateInstanceName(
            unsafeBrandId(req.params.eServiceId),
            req.body.name,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateTemplateInstanceNameErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/internal/templates/eservices/:eServiceId/description/update",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.internalUpdateTemplateInstanceDescription(
            unsafeBrandId(req.params.eServiceId),
            req.body.description,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateTemplateInstanceDescriptionErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/internal/templates/eservices/:eServiceId/descriptors/:descriptorId/voucherLifespan/update",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.internalUpdateTemplateInstanceDescriptorVoucherLifespan(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.body.voucherLifespan,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateTemplateInstanceDescriptorVoucherLifespanErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/internal/templates/eservices/:eServiceId/descriptors/:descriptorId/attributes/update",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.internalUpdateTemplateInstanceDescriptorAttributes(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateTemplateInstanceDescriptorAttributesErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/internal/templates/eservices/:eServiceId/descriptors/:descriptorId/documents/update",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.internalCreateTemplateInstanceDescriptorDocument(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createTemplateInstanceDescriptorDocumentErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/internal/templates/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.internalDeleteTemplateInstanceDescriptorDocument(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteTemplateInstanceDescriptorDocumentErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/internal/templates/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update",
      authorizationMiddleware([INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          await catalogService.innerUpdateTemplateInstanceDescriptorDocument(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            unsafeBrandId(req.params.documentId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateTemplateInstanceDescriptorDocumentErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/eservices/:eServiceId/descriptors/:descriptorId/interface/soap",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const updatedEservice =
            await catalogService.addEServiceTemplateInstanceInterface(
              unsafeBrandId(req.params.eServiceId),
              unsafeBrandId(req.params.descriptorId),
              req.body,
              ctx
            );
          return res.status(200).send(eServiceToApiEService(updatedEservice));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            addEServiceTemplateInstanceInterfaceErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/eservices/:eServiceId/descriptors/:descriptorId/interface/rest",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      // eslint-disable-next-line sonarjs/no-identical-functions
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const updatedEservice =
            await catalogService.addEServiceTemplateInstanceInterface(
              unsafeBrandId(req.params.eServiceId),
              unsafeBrandId(req.params.descriptorId),
              req.body,
              ctx
            );
          return res.status(200).send(eServiceToApiEService(updatedEservice));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            addEServiceTemplateInstanceInterfaceErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/eservices/:eServiceId/descriptors",
      authorizationMiddleware([ADMIN_ROLE, API_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const descriptor =
            await catalogService.createTemplateInstanceDescriptor(
              unsafeBrandId(req.params.eServiceId),
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(
              catalogApi.EServiceDescriptor.parse(
                descriptorToApiDescriptor(descriptor)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createTemplateInstanceDescriptorErrorMapper,
            ctx.logger,
            ctx.correlationId
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return eservicesRouter;
};
export default eservicesRouter;
