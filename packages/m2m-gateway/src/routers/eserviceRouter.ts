import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  validateAuthorization,
  authRole,
} from "pagopa-interop-commons";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { EserviceService } from "../services/eserviceService.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";
import {
  getEserviceDescriptorErrorMapper,
  downloadEServiceDescriptorInterfaceErrorMapper,
  uploadEServiceDescriptorInterfaceErrorMapper,
  deleteEServiceDescriptorInterfaceErrorMapper,
  deleteDraftEServiceDescriptorErrorMapper,
  getEServiceDescriptorAttributesErrorMapper,
  getEServiceRiskAnalysisErrorMapper,
} from "../utils/errorMappers.js";
import { sendDownloadedDocumentAsFormData } from "../utils/fileDownload.js";

const { M2M_ADMIN_ROLE, M2M_ROLE } = authRole;

const eserviceRouter = (
  ctx: ZodiosContext,
  eserviceService: EserviceService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const eserviceRouter = ctx.router(m2mGatewayApi.eservicesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  eserviceRouter
    .get("/eservices", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const eservices = await eserviceService.getEServices(req.query, ctx);

        return res.status(200).send(m2mGatewayApi.EServices.parse(eservices));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving eservices`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/eservices", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const eservice = await eserviceService.createEService(req.body, ctx);

        return res.status(200).send(m2mGatewayApi.EService.parse(eservice));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating eservice`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/eservices/:eserviceId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const eservice = await eserviceService.getEService(
          unsafeBrandId(req.params.eserviceId),
          ctx
        );

        return res.status(200).send(m2mGatewayApi.EService.parse(eservice));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving eservice with id ${req.params.eserviceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .patch("/eservices/:eserviceId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const eservice = await eserviceService.updateDraftEService(
          unsafeBrandId(req.params.eserviceId),
          req.body,
          ctx
        );

        return res.status(200).send(m2mGatewayApi.EService.parse(eservice));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error updating eservice with id ${req.params.eserviceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/eservices/:eserviceId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        await eserviceService.deleteEService(
          unsafeBrandId(req.params.eserviceId),
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error deleting eservice with id ${req.params.eserviceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .patch("/eservices/:eserviceId/delegation", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const eservice =
          await eserviceService.updatePublishedEServiceDelegation(
            unsafeBrandId(req.params.eserviceId),
            req.body,
            ctx
          );

        return res.status(200).send(m2mGatewayApi.EService.parse(eservice));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error updating delegation configurations of eservice with id ${req.params.eserviceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .patch("/eservices/:eserviceId/description", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const eservice =
          await eserviceService.updatePublishedEServiceDescription(
            unsafeBrandId(req.params.eserviceId),
            req.body,
            ctx
          );

        return res.status(200).send(m2mGatewayApi.EService.parse(eservice));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error updating description of eservice with id ${req.params.eserviceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .patch("/eservices/:eserviceId/name", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const eservice = await eserviceService.updatePublishedEServiceName(
          unsafeBrandId(req.params.eserviceId),
          req.body,
          ctx
        );

        return res.status(200).send(m2mGatewayApi.EService.parse(eservice));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error updating name of eservice with id ${req.params.eserviceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/eservices/:eserviceId/descriptors", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const descriptors = await eserviceService.getEServiceDescriptors(
          unsafeBrandId(req.params.eserviceId),
          req.query,
          ctx
        );

        return res
          .status(200)
          .send(m2mGatewayApi.EServiceDescriptors.parse(descriptors));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving eservice ${req.params.eserviceId} descriptors`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/eservices/:eserviceId/descriptors", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const descriptor = await eserviceService.createDescriptor(
          unsafeBrandId(req.params.eserviceId),
          req.body,
          ctx
        );

        return res
          .status(201)
          .send(m2mGatewayApi.EServiceDescriptor.parse(descriptor));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating descriptor for eservice with id ${req.params.eserviceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/eservices/:eserviceId/descriptors/:descriptorId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

          const descriptor = await eserviceService.getEServiceDescriptor(
            unsafeBrandId(req.params.eserviceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );

          return res
            .status(200)
            .send(m2mGatewayApi.EServiceDescriptor.parse(descriptor));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getEserviceDescriptorErrorMapper,
            ctx,
            `Error retrieving eservice ${req.params.eserviceId} descriptor with id ${req.params.descriptorId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .patch(
      "/eservices/:eserviceId/descriptors/:descriptorId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          const eservice = await eserviceService.updateDraftEServiceDescriptor(
            unsafeBrandId(req.params.eserviceId),
            unsafeBrandId(req.params.descriptorId),
            req.body,
            ctx
          );

          return res
            .status(200)
            .send(m2mGatewayApi.EServiceDescriptor.parse(eservice));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error updating eservice descriptor with id ${req.params.descriptorId} for eservice ${req.params.eserviceId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/eservices/:eserviceId/descriptors/:descriptorId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          await eserviceService.deleteDraftEServiceDescriptor(
            unsafeBrandId(req.params.eserviceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteDraftEServiceDescriptorErrorMapper,
            ctx,
            `Error deleting descriptor with id ${req.params.descriptorId} for eservice ${req.params.eserviceId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eserviceId/descriptors/:descriptorId/documents",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          const document =
            await eserviceService.uploadEServiceDescriptorDocument(
              unsafeBrandId(req.params.eserviceId),
              unsafeBrandId(req.params.descriptorId),
              req.body,
              ctx
            );

          return res.status(201).send(m2mGatewayApi.Document.parse(document));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error uploading document for eservice ${req.params.eserviceId} descriptor with id ${req.params.descriptorId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/eservices/:eserviceId/descriptors/:descriptorId/documents",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

          const documents =
            await eserviceService.getEServiceDescriptorDocuments(
              unsafeBrandId(req.params.eserviceId),
              unsafeBrandId(req.params.descriptorId),
              req.query,
              ctx
            );

          return res.status(200).send(m2mGatewayApi.Documents.parse(documents));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error retrieving documents for eservice ${req.params.eserviceId} descriptor with id ${req.params.descriptorId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/eservices/:eserviceId/descriptors/:descriptorId/documents/:documentId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);
          const file = await eserviceService.downloadEServiceDescriptorDocument(
            unsafeBrandId(req.params.eserviceId),
            unsafeBrandId(req.params.descriptorId),
            unsafeBrandId(req.params.documentId),
            ctx
          );

          return sendDownloadedDocumentAsFormData(file, res);
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error retrieving document with id ${req.params.documentId} for eservice ${req.params.eserviceId} descriptor with id ${req.params.descriptorId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/eservices/:eserviceId/descriptors/:descriptorId/documents/:documentId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          await eserviceService.deleteEServiceDescriptorDocument(
            unsafeBrandId(req.params.eserviceId),
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
            `Error deleting document with id ${req.params.documentId} for eservice ${req.params.eserviceId} descriptor with id ${req.params.descriptorId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/eservices/:eserviceId/descriptors/:descriptorId/interface",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);
          const file =
            await eserviceService.downloadEServiceDescriptorInterface(
              unsafeBrandId(req.params.eserviceId),
              unsafeBrandId(req.params.descriptorId),
              ctx
            );

          return sendDownloadedDocumentAsFormData(file, res);
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            downloadEServiceDescriptorInterfaceErrorMapper,
            ctx,
            `Error retrieving interface for eservice ${req.params.eserviceId} descriptor with id ${req.params.descriptorId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eserviceId/descriptors/:descriptorId/interface",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          const document =
            await eserviceService.uploadEServiceDescriptorInterface(
              unsafeBrandId(req.params.eserviceId),
              unsafeBrandId(req.params.descriptorId),
              req.body,
              ctx
            );

          return res.status(201).send(m2mGatewayApi.Document.parse(document));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            uploadEServiceDescriptorInterfaceErrorMapper,
            ctx,
            `Error uploading interface for eservice ${req.params.eserviceId} descriptor with id ${req.params.descriptorId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/eservices/:eserviceId/descriptors/:descriptorId/interface",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          await eserviceService.deleteEServiceDescriptorInterface(
            unsafeBrandId(req.params.eserviceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteEServiceDescriptorInterfaceErrorMapper,
            ctx,
            `Error deleting interface for eservice ${req.params.eserviceId} descriptor with id ${req.params.descriptorId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eserviceId/descriptors/:descriptorId/suspend",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);
          const eserviceDescriptor = await eserviceService.suspendDescriptor(
            unsafeBrandId(req.params.eserviceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          return res
            .status(200)
            .send(m2mGatewayApi.EServiceDescriptor.parse(eserviceDescriptor));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error suspending descriptor with ${req.params.descriptorId} for eservice with id ${req.params.eserviceId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eserviceId/descriptors/:descriptorId/unsuspend",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);
          const eserviceDescriptor = await eserviceService.unsuspendDescriptor(
            unsafeBrandId(req.params.eserviceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );

          return res
            .status(200)
            .send(m2mGatewayApi.EServiceDescriptor.parse(eserviceDescriptor));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error unsuspending descriptor with id ${req.params.descriptorId} for eservice with id ${req.params.eserviceId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eserviceId/descriptors/:descriptorId/publish",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          const eserviceDescriptor = await eserviceService.publishDescriptor(
            unsafeBrandId(req.params.eserviceId),
            unsafeBrandId(req.params.descriptorId),
            ctx
          );
          return res
            .status(200)
            .send(m2mGatewayApi.EServiceDescriptor.parse(eserviceDescriptor));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error publishing descriptor with ${req.params.descriptorId} for eservice with id ${req.params.eserviceId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eserviceId/descriptors/:descriptorId/approve",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          const eserviceDescriptor =
            await eserviceService.approveDelegatedEServiceDescriptor(
              unsafeBrandId(req.params.eserviceId),
              unsafeBrandId(req.params.descriptorId),
              ctx
            );
          return res
            .status(200)
            .send(m2mGatewayApi.EServiceDescriptor.parse(eserviceDescriptor));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error approving descriptor with ${req.params.descriptorId} for eservice with id ${req.params.eserviceId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/eservices/:eserviceId/descriptors/:descriptorId/reject",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          const eserviceDescriptor =
            await eserviceService.rejectDelegatedEServiceDescriptor(
              unsafeBrandId(req.params.eserviceId),
              unsafeBrandId(req.params.descriptorId),
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(m2mGatewayApi.EServiceDescriptor.parse(eserviceDescriptor));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error rejecting descriptor ${req.params.descriptorId} for delegated eservice ${req.params.eserviceId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/eservices/:eserviceId/riskAnalyses", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const riskAnalysis = await eserviceService.createEServiceRiskAnalysis(
          unsafeBrandId(req.params.eserviceId),
          req.body,
          ctx
        );
        return res
          .status(201)
          .send(m2mGatewayApi.EServiceRiskAnalysis.parse(riskAnalysis));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating risk analysis for eservice with id ${req.params.eserviceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/eservices/:eserviceId/riskAnalyses", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const riskAnalysis = await eserviceService.getEServiceRiskAnalyses(
          unsafeBrandId(req.params.eserviceId),
          req.query,
          ctx
        );
        return res
          .status(200)
          .send(m2mGatewayApi.EServiceRiskAnalyses.parse(riskAnalysis));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving risk analyses for eservice with id ${req.params.eserviceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/eservices/:eserviceId/riskAnalyses/:riskAnalysisId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

          const riskAnalysis = await eserviceService.getEServiceRiskAnalysis(
            unsafeBrandId(req.params.eserviceId),
            unsafeBrandId(req.params.riskAnalysisId),
            ctx
          );
          return res
            .status(200)
            .send(m2mGatewayApi.EServiceRiskAnalysis.parse(riskAnalysis));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getEServiceRiskAnalysisErrorMapper,
            ctx,
            `Error retrieving risk analysis ${req.params.riskAnalysisId} for eservice with id ${req.params.eserviceId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/eservices/:eserviceId/riskAnalyses/:riskAnalysisId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          await eserviceService.deleteEServiceRiskAnalysis(
            unsafeBrandId(req.params.eserviceId),
            unsafeBrandId(req.params.riskAnalysisId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error deleting risk analysis ${req.params.riskAnalysisId} for eservice with id ${req.params.eserviceId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );
    .put(
      "/eservices/:eserviceId/descriptors/:descriptorId/certifiedAttributes",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          const updatedAttributes =
            await eserviceService.updateEServiceDescriptorCertifiedAttributes(
              unsafeBrandId(req.params.eserviceId),
              unsafeBrandId(req.params.descriptorId),
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(
              m2mGatewayApi.EServiceDescriptorCertifiedAttributesResponse.parse(
                updatedAttributes
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getEServiceDescriptorAttributesErrorMapper,
            ctx,
            `Error updating certified attributes for descriptor with id ${req.params.descriptorId} for eservice with id ${req.params.eserviceId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .put(
      "/eservices/:eserviceId/descriptors/:descriptorId/declaredAttributes",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          const updatedAttributes =
            await eserviceService.updateEServiceDescriptorDeclaredAttributes(
              unsafeBrandId(req.params.eserviceId),
              unsafeBrandId(req.params.descriptorId),
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(
              m2mGatewayApi.EServiceDescriptorDeclaredAttributesResponse.parse(
                updatedAttributes
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getEServiceDescriptorAttributesErrorMapper,
            ctx,
            `Error updating declared attributes for descriptor with id ${req.params.descriptorId} for eservice with id ${req.params.eserviceId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .put(
      "/eservices/:eserviceId/descriptors/:descriptorId/verifiedAttributes",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          const updatedAttributes =
            await eserviceService.updateEServiceDescriptorVerifiedAttributes(
              unsafeBrandId(req.params.eserviceId),
              unsafeBrandId(req.params.descriptorId),
              req.body,
              ctx
            );
          return res
            .status(200)
            .send(
              m2mGatewayApi.EServiceDescriptorVerifiedAttributesResponse.parse(
                updatedAttributes
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getEServiceDescriptorAttributesErrorMapper,
            ctx,
            `Error updating verified attributes for descriptor with id ${req.params.descriptorId} for eservice with id ${req.params.eserviceId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return eserviceRouter;
};

export default eserviceRouter;
