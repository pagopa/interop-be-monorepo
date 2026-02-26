/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { constants } from "http2";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import {
  authRole,
  ExpressContext,
  validateAuthorization,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import {
  DescriptorId,
  EServiceDocumentId,
  EServiceId,
  unsafeBrandId,
  emptyErrorMapper,
} from "pagopa-interop-models";
import {
  toBffCatalogApiDescriptorDoc,
  toEserviceCatalogProcessQueryParams,
} from "../api/catalogApiConverter.js";
import { makeApiProblem } from "../model/errors.js";
import { CatalogService } from "../services/catalogService.js";
import { fromBffAppContext } from "../utilities/context.js";
import {
  addEServiceInterfaceByTemplateErrorMapper,
  bffGetCatalogErrorMapper,
  createEServiceDocumentErrorMapper,
  exportEServiceDescriptorErrorMapper,
  importEServiceErrorMapper,
  getEServiceTemplateInstancesErrorMapper,
} from "../utilities/errorMappers.js";

const catalogRouter = (
  ctx: ZodiosContext,
  catalogService: CatalogService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const catalogRouter = ctx.router(bffApi.eservicesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  catalogRouter
    .get("/catalog", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      const queryParams = toEserviceCatalogProcessQueryParams(req.query);
      try {
        const response = await catalogService.getCatalog(ctx, queryParams);

        return res.status(200).send(bffApi.CatalogEServices.parse(response));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          bffGetCatalogErrorMapper,
          ctx,
          "Error retrieving Catalog EServices"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/producers/eservices", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const response = await catalogService.getProducerEServices(
          req.query.q,
          req.query.consumersIds,
          req.query.delegated,
          req.query.personalData,
          req.query.offset,
          req.query.limit,
          ctx
        );

        return res.status(200).send(bffApi.ProducerEServices.parse(response));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          bffGetCatalogErrorMapper,
          ctx,
          "Error retrieving Producer EServices"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/producers/eservices/:eserviceId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const response = await catalogService.getProducerEServiceDetails(
          unsafeBrandId(req.params.eserviceId),
          ctx
        );
        return res
          .status(200)
          .send(bffApi.ProducerEServiceDetails.parse(response));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          bffGetCatalogErrorMapper,
          ctx,
          `Error retrieving producer eservice ${req.params.eserviceId}`
        );
        return res.status(errorRes.status).send(errorRes);
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
          return res
            .status(200)
            .send(bffApi.ProducerEServiceDescriptor.parse(response));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            bffGetCatalogErrorMapper,
            ctx,
            `Error retrieving producer descriptor ${req.params.descriptorId} for eservice ${req.params.eserviceId}`
          );
          return res.status(errorRes.status).send(errorRes);
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

          return res
            .status(200)
            .send(bffApi.CatalogEServiceDescriptor.parse(response));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            bffGetCatalogErrorMapper,
            ctx,
            `Error retrieving descriptor ${req.params.descriptorId} of eservice ${req.params.eserviceId} from catalog`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/templates/:templateId/eservices", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const response =
          await catalogService.createEServiceInstanceFromTemplate(
            unsafeBrandId(req.params.templateId),
            req.body,
            ctx
          );

        return res
          .status(200)
          .send(bffApi.CreatedEServiceDescriptor.parse(response));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating EService instance from template ${req.params.templateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
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
          ctx,
          `Error getting consumers of eservice ${req.params.eServiceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          await catalogService.deleteDraft(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error while deleting draft descriptor ${req.params.descriptorId} for E-Service ${req.params.eServiceId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .put(
      "/eservices/:eServiceId/descriptors/:descriptorId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          const createdResource = await catalogService.updateDraftDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.body,
            ctx
          );
          return res
            .status(200)
            .send(bffApi.CreatedResource.parse(createdResource));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating draft descriptor ${
              req.params.descriptorId
            } on service ${req.params.eServiceId} with seed: ${JSON.stringify(
              req.body
            )}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/eservices/:eServiceId/descriptors/:descriptorId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          const createdResource =
            await catalogService.updateDraftDescriptorTemplateInstance(
              unsafeBrandId(req.params.eServiceId),
              unsafeBrandId(req.params.descriptorId),
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(bffApi.CreatedResource.parse(createdResource));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating draft descriptor ${
              req.params.descriptorId
            } on eservice ${
              req.params.eServiceId
            } template instance with seed: ${JSON.stringify(req.body)}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/eservices/:eServiceId/descriptors", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const createdResource = await catalogService.createDescriptor(
          unsafeBrandId(req.params.eServiceId),
          ctx
        );
        return res
          .status(200)
          .send(bffApi.CreatedResource.parse(createdResource));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating descriptor in EService ${req.params.eServiceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/activate",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
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
            emptyErrorMapper,
            ctx,
            `Error activating descriptor ${req.params.descriptorId} on service ${req.params.eServiceId}`
          );
          return res.status(errorRes.status).send(errorRes);
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
            unsafeBrandId(req.params.descriptorId),
            req.body,
            ctx
          );
          return res.status(200).send(bffApi.CreatedResource.parse({ id }));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating descriptor ${req.params.descriptorId} on service ${
              req.params.eServiceId
            } with seed: ${JSON.stringify(req.body)}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/agreementApprovalPolicy/update",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          await catalogService.updateAgreementApprovalPolicy(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating agreementApprovalPolicy of descriptor ${
              req.params.descriptorId
            } on service ${req.params.eServiceId} with seed: ${JSON.stringify(
              req.body
            )}`
          );
          return res.status(errorRes.status).send(errorRes);
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
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error publishing descriptor ${req.params.descriptorId} for service ${req.params.eServiceId}`
          );
          return res.status(errorRes.status).send(errorRes);
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
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error suspending descriptor ${req.params.descriptorId} for service ${req.params.eServiceId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [authRole.ADMIN_ROLE, authRole.API_ROLE]);

          const resp = await catalogService.createEServiceDocument(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.body,
            ctx
          );
          return res.status(200).send(bffApi.CreatedResource.parse(resp));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createEServiceDocumentErrorMapper,
            ctx,
            `Error creating eService document of kind ${req.body.kind} and name ${req.body.prettyName} for eService ${req.params.eServiceId} and descriptor ${req.params.descriptorId}`
          );
          return res.status(errorRes.status).send(errorRes);
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
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error deleting document ${req.params.documentId} for eService ${req.params.eServiceId} descriptor ${req.params.descriptorId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/eservices/:eServiceId/descriptors/:descriptorId/documents/:documentId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          const { contentType, document } =
            await catalogService.getEServiceDocumentById(
              unsafeBrandId(req.params.eServiceId),
              unsafeBrandId(req.params.descriptorId),
              unsafeBrandId(req.params.documentId),
              ctx
            );
          return res
            .header(constants.HTTP2_HEADER_CONTENT_TYPE, contentType)
            .status(200)
            .send(document);
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error getting document ${req.params.documentId} for eService ${req.params.eServiceId} descriptor ${req.params.descriptorId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
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
          return res
            .status(200)
            .send(
              bffApi.CreatedEServiceDescriptor.parse(createdEServiceDescriptor)
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error cloning eService ${req.params.eServiceId} with descriptor ${req.params.descriptorId}`
          );
          return res.status(errorRes.status).send(errorRes);
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

          return res
            .status(200)
            .send(bffApi.EServiceDoc.parse(toBffCatalogApiDescriptorDoc(doc)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            bffGetCatalogErrorMapper,
            ctx,
            `Error updating document ${documentId} on eService ${eServiceId} for descriptor ${descriptorId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/eservices", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const createdResource = await catalogService.createEService(
          req.body,
          ctx
        );
        return res
          .status(200)
          .send(bffApi.CreatedEServiceDescriptor.parse(createdResource));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating eservice with seed: ${JSON.stringify(req.body)}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/eservices/:eServiceId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await catalogService.deleteEService(
          unsafeBrandId(req.params.eServiceId),
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error deleting EService ${req.params.eServiceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .put("/eservices/:eServiceId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const createdResource = await catalogService.updateEServiceById(
          unsafeBrandId(req.params.eServiceId),
          req.body,
          ctx
        );
        return res
          .status(200)
          .send(bffApi.CreatedResource.parse(createdResource));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error updating EService ${req.params.eServiceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/templates/eservices/:eServiceId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const createdResource =
          await catalogService.updateEServiceTemplateInstanceById(
            unsafeBrandId(req.params.eServiceId),
            req.body,
            ctx
          );
        return res
          .status(200)
          .send(bffApi.CreatedResource.parse(createdResource));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error updating EService ${req.params.eServiceId} template instance`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
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
          emptyErrorMapper,
          ctx,
          `Error inserting risk analysis ${req.body.name} to eservice ${req.params.eServiceId} from catalog`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/eservices/:eServiceId/description/update", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const id = await catalogService.updateEServiceDescription(
          ctx,
          unsafeBrandId(req.params.eServiceId),
          req.body
        );
        return res.status(200).send(bffApi.CreatedResource.parse(id));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error updating description of eservice with Id: ${req.params.eServiceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/eservices/:eServiceId/delegationFlags/update", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const id = await catalogService.updateEServiceFlags(
          ctx,
          unsafeBrandId(req.params.eServiceId),
          req.body
        );
        return res.status(200).send(bffApi.CreatedResource.parse(id));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error updating delegation flags of eservice with Id: ${req.params.eServiceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/eservices/:eServiceId/name/update", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await catalogService.updateEServiceName(
          ctx,
          unsafeBrandId(req.params.eServiceId),
          req.body
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error updating name of eservice with Id: ${req.params.eServiceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/eservices/:eServiceId/signalhub/update", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await catalogService.updateEServiceSignalHubFlag(
          ctx,
          unsafeBrandId(req.params.eServiceId),
          req.body
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error updating signalhub for eservice with Id: ${req.params.eServiceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/eservices/:eServiceId/personalDataFlag", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await catalogService.updateEServicePersonalDataFlag(
          ctx,
          unsafeBrandId(req.params.eServiceId),
          req.body
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error setting personalData flag for eservice with Id: ${req.params.eServiceId}`
        );
        return res.status(errorRes.status).send(errorRes);
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

          return res
            .status(200)
            .send(bffApi.EServiceRiskAnalysis.parse(riskAnalysis));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            bffGetCatalogErrorMapper,
            ctx,
            `Error retrieving risk analysis ${req.params.riskAnalysisId} to eservice ${req.params.eServiceId} from catalog`
          );
          return res.status(errorRes.status).send(errorRes);
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
            ctx,
            `Error updating risk analysis ${req.params.riskAnalysisId} to eservice ${req.params.eServiceId} from catalog`
          );
          return res.status(errorRes.status).send(errorRes);
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
            emptyErrorMapper,
            ctx,
            `Error deleting risk analysis ${req.params.riskAnalysisId} to eservice ${req.params.eServiceId} from catalog`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/export/eservices/:eserviceId/descriptors/:descriptorId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          const response = await catalogService.exportEServiceDescriptor(
            unsafeBrandId(req.params.eserviceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );

          return res.send(bffApi.FileResource.parse(response));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            exportEServiceDescriptorErrorMapper,
            ctx,
            `Error exporting eservice ${req.params.eserviceId} with descriptor ${req.params.descriptorId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get("/import/eservices/presignedUrl", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const response = await catalogService.generatePutPresignedUrl(
          req.query.fileName,
          ctx
        );

        return res.status(200).send(bffApi.PresignedUrl.parse(response));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          bffGetCatalogErrorMapper,
          ctx,
          "Error getting eservice import presigned url"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/import/eservices", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const createdEServiceDescriptor = await catalogService.importEService(
          req.body,
          ctx
        );
        return res
          .status(200)
          .send(
            bffApi.CreatedEServiceDescriptor.parse(createdEServiceDescriptor)
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          importEServiceErrorMapper,
          ctx,
          "Error importing eService"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/approve",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
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
            emptyErrorMapper,
            ctx,
            `Error approving eService ${req.params.eServiceId} version ${req.params.descriptorId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/reject",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
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
            emptyErrorMapper,
            ctx,
            `Error rejecting eService ${req.params.eServiceId} version ${req.params.descriptorId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eServiceId/descriptors/:descriptorId/attributes/update",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          await catalogService.updateDescriptorAttributes(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.body,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating attributes for eService ${req.params.eServiceId} descriptor ${req.params.descriptorId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/templates/eservices/:eServiceId/upgrade", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const response = await catalogService.upgradeEServiceInstance(
          unsafeBrandId(req.params.eServiceId),
          ctx
        );
        return res.status(200).send(bffApi.CreatedResource.parse(response));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error upgrading eService ${req.params.eServiceId} to the latest version of its reference template`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/templates/eservices/:eServiceId/descriptors/:descriptorId/interface/soap",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          const descriptorId =
            await catalogService.addEServiceTemplateInstanceInterfaceSoap(
              unsafeBrandId(req.params.eServiceId),
              unsafeBrandId(req.params.descriptorId),
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(bffApi.CreatedResource.parse(descriptorId));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            addEServiceInterfaceByTemplateErrorMapper,
            ctx,
            `Error adding interface for eService ${req.params.eServiceId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/eservices/:eServiceId/descriptors/:descriptorId/interface/rest",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          const descriptorId =
            await catalogService.addEServiceTemplateInstanceInterfaceRest(
              unsafeBrandId(req.params.eServiceId),
              unsafeBrandId(req.params.descriptorId),
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(bffApi.CreatedResource.parse(descriptorId));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            addEServiceInterfaceByTemplateErrorMapper,
            ctx,
            `Error adding interface for eService ${req.params.eServiceId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get("/templates/:templateId/eservices", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      const { templateId } = req.params;
      const { producerName, states, offset, limit } = req.query;

      try {
        const result =
          await catalogService.getEServiceTemplateInstancesForCreator(
            unsafeBrandId(templateId),
            producerName,
            states,
            offset,
            limit,
            ctx
          );
        return res
          .status(200)
          .send(bffApi.EServiceTemplateInstances.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getEServiceTemplateInstancesErrorMapper,
          ctx,
          `Error retrieving eservice template ${templateId} instances`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/templates/:templateId/myInstances", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      const { templateId } = req.params;
      const { offset, limit } = req.query;

      try {
        const result = await catalogService.getMyEServiceTemplateInstances(
          unsafeBrandId(templateId),
          offset,
          limit,
          ctx
        );
        return res
          .status(200)
          .send(bffApi.EServiceTemplateInstances.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getEServiceTemplateInstancesErrorMapper,
          ctx,
          `Error retrieving eservice template ${templateId} instances`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/eservices/names/availability", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      const { name } = req.query;

      try {
        const result = await catalogService.isEServiceNameAvailable(name, ctx);
        return res.status(200).send(result);
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error checking eservice name availability with name ${name}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/templates/eservices/:eServiceId/descriptors/:descriptorId/update",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          const { id } = await catalogService.updateTemplateInstanceDescriptor(
            unsafeBrandId(req.params.eServiceId),
            unsafeBrandId(req.params.descriptorId),
            req.body,
            ctx
          );
          return res.status(200).send(bffApi.CreatedResource.parse({ id }));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating template instance descriptor ${
              req.params.descriptorId
            } on service ${req.params.eServiceId} with seed: ${JSON.stringify(
              req.body
            )}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/templates/eservices/:eServiceId/instanceLabel/update",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        try {
          const result = await catalogService.updateEServiceInstanceLabel(
            ctx,
            unsafeBrandId(req.params.eServiceId),
            req.body
          );
          return res.status(200).send(bffApi.CreatedResource.parse(result));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating instance label for eservice with Id: ${req.params.eServiceId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return catalogRouter;
};

export default catalogRouter;
