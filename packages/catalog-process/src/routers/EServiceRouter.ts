import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { catalogApi } from "pagopa-interop-api-clients";
import {
  assertFeatureFlagEnabled,
  authRole,
  ExpressContext,
  fromAppContext,
  setMetadataVersionHeader,
  validateAuthorization,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import {
  AttributeId,
  EServiceId,
  EServiceTemplateId,
  TenantId,
  unsafeBrandId,
  emptyErrorMapper,
} from "pagopa-interop-models";
import {
  agreementStateToApiAgreementState,
  apiAgreementStateToAgreementState,
  apiDescriptorStateToDescriptorState,
  apiEServiceModeToEServiceMode,
  apiTechnologyToTechnology,
  descriptorStateToApiEServiceDescriptorState,
  descriptorToApiDescriptor,
  documentToApiDocument,
  eServiceToApiEService,
} from "../model/domain/apiConverter.js";
import { makeApiProblem } from "../model/domain/errors.js";
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
  updateTemplateInstanceDescriptorErrorMapper,
  updateAgreementApprovalPolicyErrorMapper,
  updateEServiceSignalhubFlagErrorMapper,
  documentListErrorMapper,
  updateEServicePersonalDataFlagErrorMapper,
  updateTemplateInstancePersonalDataErrorMapper,
} from "../utilities/errorMappers.js";
import { CatalogService } from "../services/catalogService.js";
import { config } from "../config/config.js";

const eservicesRouter = (
  ctx: ZodiosContext,
  catalogService: CatalogService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const eservicesRouter = ctx.router(catalogApi.processApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const {
    ADMIN_ROLE,
    SECURITY_ROLE,
    API_ROLE,
    M2M_ROLE,
    M2M_ADMIN_ROLE,
    INTERNAL_ROLE,
    SUPPORT_ROLE,
  } = authRole;

  eservicesRouter
    .get("/eservices", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SUPPORT_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
        ]);

        const {
          name,
          eservicesIds,
          producersIds,
          attributesIds,
          states,
          technology,
          isSignalHubEnabled,
          isClientAccessDelegable,
          agreementStates,
          mode,
          delegated,
          isConsumerDelegable,
          templatesIds,
          offset,
          limit,
        } = req.query;

        const catalogs = await catalogService.getEServices(
          {
            eservicesIds: eservicesIds.map<EServiceId>(unsafeBrandId),
            producersIds: producersIds.map<TenantId>(unsafeBrandId),
            attributesIds: attributesIds.map<AttributeId>(unsafeBrandId),
            states: states.map(apiDescriptorStateToDescriptorState),
            agreementStates: agreementStates.map(
              apiAgreementStateToAgreementState
            ),
            technology: technology
              ? apiTechnologyToTechnology(technology)
              : undefined,
            isSignalHubEnabled,
            isClientAccessDelegable,
            name,
            mode: mode ? apiEServiceModeToEServiceMode(mode) : undefined,
            isConsumerDelegable,
            delegated,
            templatesIds: templatesIds.map<EServiceTemplateId>(unsafeBrandId),
          },
          offset,
          limit,
          ctx
        );

        return res.status(200).send(
          catalogApi.EServices.parse({
            results: catalogs.results.map(eServiceToApiEService),
            totalCount: catalogs.totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/eservices", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

        const { data: eService, metadata } =
          await catalogService.createEService(req.body, ctx);
        setMetadataVersionHeader(res, metadata);
        return res
          .status(201)
          .send(catalogApi.EService.parse(eServiceToApiEService(eService)));
      } catch (error) {
        const errorRes = makeApiProblem(error, createEServiceErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/templates/:templateId/eservices", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

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
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/eservices/:eServiceId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SUPPORT_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
          INTERNAL_ROLE,
        ]);

        const { data: eservice, metadata } =
          await catalogService.getEServiceById(
            unsafeBrandId(req.params.eServiceId),
            ctx
          );
        setMetadataVersionHeader(res, metadata);
        return res
          .status(200)
          .send(catalogApi.EService.parse(eServiceToApiEService(eservice)));
      } catch (error) {
        const errorRes = makeApiProblem(error, getEServiceErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .put("/eservices/:eServiceId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

        const { data: updatedEService } = await catalogService.updateEService(
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
        const errorRes = makeApiProblem(error, updateEServiceErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .patch("/eservices/:eServiceId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const { data: updatedEService, metadata } =
          await catalogService.patchUpdateEService(
            unsafeBrandId(req.params.eServiceId),
            req.body,
            ctx
          );

        setMetadataVersionHeader(res, metadata);
        return res
          .status(200)
          .send(
            catalogApi.EService.parse(eServiceToApiEService(updatedEService))
          );
      } catch (error) {
        const errorRes = makeApiProblem(error, updateEServiceErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/templates/eservices/:eServiceId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

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
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/eservices/:eServiceId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

        await catalogService.deleteEService(
          unsafeBrandId(req.params.eServiceId),
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, deleteEServiceErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/eservices/:eServiceId/consumers", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SUPPORT_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
        ]);

        const consumers = await catalogService.getEServiceConsumers(
          unsafeBrandId(req.params.eServiceId),
          req.query.offset,
          req.query.limit,
          ctx
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
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [
            ADMIN_ROLE,
            API_ROLE,
            SUPPORT_ROLE,
            SECURITY_ROLE,
            M2M_ROLE,
            M2M_ADMIN_ROLE,
          ]);

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
          const errorRes = makeApiProblem(error, documentGetErrorMapper, ctx);
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [
            ADMIN_ROLE,
            API_ROLE,
            SUPPORT_ROLE,
            SECURITY_ROLE,
            M2M_ROLE,
            M2M_ADMIN_ROLE,
          ]);

          const { eServiceId, descriptorId } = req.params;

          const documents = await catalogService.getDocuments(
            unsafeBrandId(eServiceId),
            unsafeBrandId(descriptorId),
            req.query,
            ctx
          );

          return res.status(200).send(
            catalogApi.EServiceDocs.parse({
              results: documents.results.map(documentToApiDocument),
              totalCount: documents.totalCount,
            })
          );
        } catch (error) {
          const errorRes = makeApiProblem(error, documentListErrorMapper, ctx);
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [
            ADMIN_ROLE,
            API_ROLE,
            // ^^ The same check for the roles above is done in the backend-for-frontend
            // If you change this check, change it there too
            M2M_ADMIN_ROLE,
          ]);

          const { data: document, metadata } =
            await catalogService.uploadDocument(
              unsafeBrandId(req.params.eServiceId),
              unsafeBrandId(req.params.descriptorId),
              req.body,
              ctx
            );

          setMetadataVersionHeader(res, metadata);

          return res
            .status(200)
            .send(
              catalogApi.EServiceDoc.parse(documentToApiDocument(document))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            documentCreateErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

          const { data: eservice, metadata } =
            await catalogService.deleteDocument(
              unsafeBrandId(req.params.eServiceId),
              unsafeBrandId(req.params.descriptorId),
              unsafeBrandId(req.params.documentId),
              ctx
            );

          setMetadataVersionHeader(res, metadata);

          return res.status(200).send(eServiceToApiEService(eservice));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            documentDeleteErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

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
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/eservices/:eServiceId/descriptors", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

        const {
          data: { eservice, createdDescriptorId },
          metadata,
        } = await catalogService.createDescriptor(
          unsafeBrandId(req.params.eServiceId),
          req.body,
          ctx
        );

        setMetadataVersionHeader(res, metadata);

        return res.status(200).send(
          catalogApi.CreatedEServiceDescriptor.parse({
            eservice: eServiceToApiEService(eservice),
            createdDescriptorId,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createDescriptorErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

          const result = await catalogService.deleteDraftDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );

          if (result) {
            setMetadataVersionHeader(res, result.metadata);
          }

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteDraftDescriptorErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .put(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

          const { data: updatedEService } =
            await catalogService.updateDraftDescriptor(
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
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .patch(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          const { data: updatedEService, metadata } =
            await catalogService.patchUpdateDraftDescriptor(
              unsafeBrandId(req.params.eServiceId),
              unsafeBrandId(req.params.descriptorId),
              req.body,
              ctx
            );

          setMetadataVersionHeader(res, metadata);
          return res
            .status(200)
            .send(
              catalogApi.EService.parse(eServiceToApiEService(updatedEService))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateDraftDescriptorErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/eservices/:eServiceId/descriptors/:descriptorId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

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
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/publish",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

          const { data, metadata } = await catalogService.publishDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          setMetadataVersionHeader(res, metadata);
          return res
            .status(200)
            .send(catalogApi.EService.parse(eServiceToApiEService(data)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            publishDescriptorErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/suspend",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

          const { data, metadata } = await catalogService.suspendDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          setMetadataVersionHeader(res, metadata);
          return res
            .status(200)
            .send(catalogApi.EService.parse(eServiceToApiEService(data)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            suspendDescriptorErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/activate",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

          const { data, metadata } = await catalogService.activateDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          setMetadataVersionHeader(res, metadata);
          return res
            .status(200)
            .send(catalogApi.EService.parse(eServiceToApiEService(data)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            activateDescriptorErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/clone",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

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
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/archive",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);

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
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/update",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

          const { data: updatedEService, metadata } =
            await catalogService.updateDescriptor(
              unsafeBrandId(req.params.eServiceId),
              unsafeBrandId(req.params.descriptorId),
              req.body,
              ctx
            );

          setMetadataVersionHeader(res, metadata);

          return res
            .status(200)
            .send(
              catalogApi.EService.parse(eServiceToApiEService(updatedEService))
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateDescriptorErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/eservices/:eServiceId/riskAnalysis", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

        const {
          data: { eservice, createdRiskAnalysisId },
          metadata,
        } = await catalogService.createRiskAnalysis(
          unsafeBrandId(req.params.eServiceId),
          req.body,
          ctx
        );

        setMetadataVersionHeader(res, metadata);
        return res.status(200).send(
          catalogApi.CreatedEServiceRiskAnalysis.parse({
            eservice: eServiceToApiEService(eservice),
            createdRiskAnalysisId,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createRiskAnalysisErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/agreementApprovalPolicy/update",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

          const updatedEService =
            await catalogService.updateAgreementApprovalPolicy(
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
            updateAgreementApprovalPolicyErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

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
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/eservices/:eServiceId/description/update", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

        const { data: updatedEService, metadata } =
          await catalogService.updateEServiceDescription(
            unsafeBrandId(req.params.eServiceId),
            req.body.description,
            ctx
          );

        setMetadataVersionHeader(res, metadata);
        return res
          .status(200)
          .send(
            catalogApi.EService.parse(eServiceToApiEService(updatedEService))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          updateEServiceDescriptionErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/eservices/:eServiceId/delegationFlags/update", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

        const { data: updatedEService, metadata } =
          await catalogService.updateEServiceDelegationFlags(
            unsafeBrandId(req.params.eServiceId),
            req.body,
            ctx
          );

        setMetadataVersionHeader(res, metadata);
        return res
          .status(200)
          .send(
            catalogApi.EService.parse(eServiceToApiEService(updatedEService))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          updateEServiceFlagsErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/eservices/:eServiceId/name/update", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

        const { data: updatedEService, metadata } =
          await catalogService.updateEServiceName(
            unsafeBrandId(req.params.eServiceId),
            req.body.name,
            ctx
          );

        setMetadataVersionHeader(res, metadata);
        return res
          .status(200)
          .send(
            catalogApi.EService.parse(eServiceToApiEService(updatedEService))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          updateEServiceNameErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/eservices/:eServiceId/signalhub/update", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

        const { data: updatedEService, metadata } =
          await catalogService.updateEServiceSignalHubFlag(
            unsafeBrandId(req.params.eServiceId),
            req.body.isSignalHubEnabled,
            ctx
          );

        setMetadataVersionHeader(res, metadata);

        return res
          .status(200)
          .send(
            catalogApi.EService.parse(eServiceToApiEService(updatedEService))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          updateEServiceSignalhubFlagErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete(
      "/eservices/:eServiceId/riskAnalysis/:riskAnalysisId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

          const { metadata } = await catalogService.deleteRiskAnalysis(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.riskAnalysisId),
            ctx
          );

          setMetadataVersionHeader(res, metadata);
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteRiskAnalysisErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/approve",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

          const { data, metadata } =
            await catalogService.approveDelegatedEServiceDescriptor(
              unsafeBrandId(req.params.eServiceId),
              unsafeBrandId(req.params.descriptorId),
              ctx
            );
          setMetadataVersionHeader(res, metadata);
          return res
            .status(200)
            .send(catalogApi.EService.parse(eServiceToApiEService(data)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            approveDelegatedEServiceDescriptorErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/reject",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

          const { data, metadata } =
            await catalogService.rejectDelegatedEServiceDescriptor(
              unsafeBrandId(req.params.eServiceId),
              unsafeBrandId(req.params.descriptorId),
              req.body,
              ctx
            );
          setMetadataVersionHeader(res, metadata);
          return res
            .status(200)
            .send(catalogApi.EService.parse(eServiceToApiEService(data)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            rejectDelegatedEServiceDescriptorErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/attributes/update",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, M2M_ADMIN_ROLE]);

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
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/templates/eservices/:eServiceId/upgrade", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

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
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/internal/templates/eservices/:eServiceId/name/update",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);

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
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/internal/templates/eservices/:eServiceId/description/update",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);

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
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/internal/templates/eservices/:eServiceId/personalDataFlag",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);

          await catalogService.internalUpdateTemplateInstancePersonalDataFlag(
            unsafeBrandId(req.params.eServiceId),
            req.body.personalData,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateTemplateInstancePersonalDataErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/internal/templates/eservices/:eServiceId/descriptors/:descriptorId/voucherLifespan/update",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);

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
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/internal/templates/eservices/:eServiceId/descriptors/:descriptorId/attributes/update",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);

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
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/internal/templates/eservices/:eServiceId/descriptors/:descriptorId/documents/update",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);

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
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/internal/templates/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);

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
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/internal/templates/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId/update",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);

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
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/eservices/:eServiceId/descriptors/:descriptorId/interface/soap",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

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
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/eservices/:eServiceId/descriptors/:descriptorId/interface/rest",
      // eslint-disable-next-line sonarjs/no-identical-functions
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

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
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/templates/eservices/:eServiceId/descriptors", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

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
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/templates/eservices/:eServiceId/descriptors/:descriptorId/update",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

          const updatedEService =
            await catalogService.updateTemplateInstanceDescriptor(
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
            updateTemplateInstanceDescriptorErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/eservices/:eServiceId/personalDataFlag", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE]);

        assertFeatureFlagEnabled(config, "featureFlagEservicePersonalData");

        const updatedEService =
          await catalogService.updateEServicePersonalDataFlagAfterPublication(
            unsafeBrandId(req.params.eServiceId),
            req.body.personalData,
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
          updateEServicePersonalDataFlagErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return eservicesRouter;
};
export default eservicesRouter;
