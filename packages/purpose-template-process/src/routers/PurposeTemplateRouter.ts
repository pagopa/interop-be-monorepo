/* eslint-disable sonarjs/no-identical-functions */
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  authRole,
  ExpressContext,
  fromAppContext,
  setMetadataVersionHeader,
  validateAuthorization,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import {
  emptyErrorMapper,
  EServiceId,
  RiskAnalysisTemplateDocument,
  RiskAnalysisTemplateSignedDocument,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { PurposeTemplateService } from "../services/purposeTemplateService.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  activatePurposeTemplateErrorMapper,
  addRiskAnalysisAnswerAnnotationErrorMapper,
  archivePurposeTemplateErrorMapper,
  createPurposeTemplateErrorMapper,
  deletePurposeTemplateErrorMapper,
  deleteRiskAnalysisTemplateAnswerAnnotationDocumentErrorMapper,
  deleteRiskAnalysisTemplateAnswerAnnotationErrorMapper,
  getPurposeTemplateErrorMapper,
  getPurposeTemplateEServiceDescriptorsErrorMapper,
  getPurposeTemplatesErrorMapper,
  getRiskAnalysisTemplateAnswerAnnotationDocumentErrorMapper,
  linkEservicesToPurposeTemplateErrorMapper,
  suspendPurposeTemplateErrorMapper,
  unlinkEServicesFromPurposeTemplateErrorMapper,
  updatePurposeTemplateErrorMapper,
  addPurposeTemplateAnswerAnnotationErrorMapper,
  createRiskAnalysisAnswerErrorMapper,
  updateRiskAnalysisTemplateAnswerAnnotationDocumentErrorMapper,
  addRiskAnalysisTemplateDocumentErrorMapper,
  getRiskAnalysisTemplateSignedDocumentErrorMapper,
  getRiskAnalysisTemplateDocumentErrorMapper,
} from "../utilities/errorMappers.js";
import {
  annotationDocumentToApiAnnotationDocument,
  apiPurposeTemplateStateToPurposeTemplateState,
  eserviceDescriptorPurposeTemplateToApiEServiceDescriptorPurposeTemplate,
  purposeTemplateAnswerAnnotationToApiPurposeTemplateAnswerAnnotation,
  purposeTemplateToApiPurposeTemplate,
  riskAnalysisAnswerToApiRiskAnalysisAnswer,
  riskAnalysisTemplateDocumentToApiRiskAnalysisTemplateDocument,
  riskAnalysisTemplateSignedDocumentToApiRiskAnalysisTemplateSignedDocument,
} from "../model/domain/apiConverter.js";

const purposeTemplateRouter = (
  ctx: ZodiosContext,
  purposeTemplateService: PurposeTemplateService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const purposeTemplateRouter = ctx.router(
    purposeTemplateApi.purposeTemplateApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );

  const {
    ADMIN_ROLE,
    API_ROLE,
    M2M_ADMIN_ROLE,
    M2M_ROLE,
    SECURITY_ROLE,
    SUPPORT_ROLE,
    INTERNAL_ROLE,
  } = authRole;

  purposeTemplateRouter
    .get("/purposeTemplates", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          M2M_ADMIN_ROLE,
          M2M_ROLE,
          SECURITY_ROLE,
          SUPPORT_ROLE,
        ]);

        const {
          purposeTitle,
          creatorIds,
          eserviceIds,
          states,
          targetTenantKind,
          excludeExpiredRiskAnalysis,
          handlesPersonalData,
          offset,
          limit,
        } = req.query;

        const purposeTemplates =
          await purposeTemplateService.getPurposeTemplates(
            {
              purposeTitle,
              targetTenantKind,
              creatorIds: creatorIds?.map(unsafeBrandId<TenantId>),
              eserviceIds: eserviceIds?.map(unsafeBrandId<EServiceId>),
              states: states?.map(
                apiPurposeTemplateStateToPurposeTemplateState
              ),
              excludeExpiredRiskAnalysis,
              handlesPersonalData,
            },
            { offset, limit },
            ctx
          );
        return res.status(200).send(
          purposeTemplateApi.PurposeTemplates.parse({
            results: purposeTemplates.results.map((purposeTemplate) =>
              purposeTemplateToApiPurposeTemplate(purposeTemplate)
            ),
            totalCount: purposeTemplates.totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getPurposeTemplatesErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { data: purposeTemplate, metadata } =
          await purposeTemplateService.createPurposeTemplate(req.body, ctx);

        setMetadataVersionHeader(res, metadata);
        return res
          .status(201)
          .send(purposeTemplateToApiPurposeTemplate(purposeTemplate));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createPurposeTemplateErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/creators", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          SUPPORT_ROLE,
        ]);

        const { creatorName, offset, limit } = req.query;

        const { results, totalCount } =
          await purposeTemplateService.getPublishedPurposeTemplateCreators(
            { creatorName, limit, offset },
            ctx
          );

        return res.status(200).send(
          purposeTemplateApi.CompactOrganizations.parse({
            results,
            totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/purposeTemplates/:id", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          M2M_ADMIN_ROLE,
          M2M_ROLE,
          SECURITY_ROLE,
          SUPPORT_ROLE,
        ]);

        const { data: purposeTemplate, metadata } =
          await purposeTemplateService.getPurposeTemplateById(
            unsafeBrandId(req.params.id),
            ctx
          );

        setMetadataVersionHeader(res, metadata);

        return res
          .status(200)
          .send(
            purposeTemplateApi.PurposeTemplate.parse(
              purposeTemplateToApiPurposeTemplate(purposeTemplate)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getPurposeTemplateErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .put("/purposeTemplates/:id", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);
        const updatedPurposeTemplate =
          await purposeTemplateService.updatePurposeTemplate(
            unsafeBrandId(req.params.id),
            req.body,
            ctx
          );
        setMetadataVersionHeader(res, updatedPurposeTemplate.metadata);
        return res
          .status(200)
          .send(
            purposeTemplateToApiPurposeTemplate(updatedPurposeTemplate.data)
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          updatePurposeTemplateErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/purposeTemplates/:id", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        await purposeTemplateService.deletePurposeTemplate(
          unsafeBrandId(req.params.id),
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          deletePurposeTemplateErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/purposeTemplates/:id/eservices", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          M2M_ADMIN_ROLE,
          M2M_ROLE,
          SECURITY_ROLE,
          SUPPORT_ROLE,
        ]);

        const { producerIds, eserviceName, offset, limit } = req.query;
        const purposeTemplateEServicesDescriptors =
          await purposeTemplateService.getPurposeTemplateEServiceDescriptors(
            {
              purposeTemplateId: unsafeBrandId(req.params.id),
              producerIds: producerIds?.map(unsafeBrandId<TenantId>),
              eserviceName,
            },
            { offset, limit },
            ctx
          );

        return res.status(200).send(
          purposeTemplateApi.EServiceDescriptorsPurposeTemplate.parse({
            results: purposeTemplateEServicesDescriptors.results.map(
              (purposeTemplateEServiceDescriptor) =>
                eserviceDescriptorPurposeTemplateToApiEServiceDescriptorPurposeTemplate(
                  purposeTemplateEServiceDescriptor
                )
            ),
            totalCount: purposeTemplateEServicesDescriptors.totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getPurposeTemplateEServiceDescriptorsErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates/:id/linkEservices", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const eserviceDescriptorPurposeTemplates =
          await purposeTemplateService.linkEservicesToPurposeTemplate(
            unsafeBrandId(req.params.id),
            req.body.eserviceIds.map(unsafeBrandId<EServiceId>),
            ctx
          );

        if (eserviceDescriptorPurposeTemplates.length !== 0) {
          setMetadataVersionHeader(
            res,
            eserviceDescriptorPurposeTemplates[0].metadata
          );
        }

        return res
          .status(200)
          .send(
            eserviceDescriptorPurposeTemplates.map(
              (eserviceDescriptorPurposeTemplate) =>
                eserviceDescriptorPurposeTemplateToApiEServiceDescriptorPurposeTemplate(
                  eserviceDescriptorPurposeTemplate.data
                )
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          linkEservicesToPurposeTemplateErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates/:id/unlinkEservices", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const eserviceDescriptorPurposeTemplates =
          await purposeTemplateService.unlinkEservicesFromPurposeTemplate(
            unsafeBrandId(req.params.id),
            req.body.eserviceIds.map(unsafeBrandId<EServiceId>),
            ctx
          );

        if (eserviceDescriptorPurposeTemplates.length !== 0) {
          setMetadataVersionHeader(
            res,
            eserviceDescriptorPurposeTemplates[0].metadata
          );
        }

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          unlinkEServicesFromPurposeTemplateErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates/:id/suspend", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { metadata } =
          await purposeTemplateService.suspendPurposeTemplate(
            unsafeBrandId(req.params.id),
            ctx
          );

        setMetadataVersionHeader(res, metadata);

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          suspendPurposeTemplateErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates/:id/unsuspend", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { metadata } =
          await purposeTemplateService.unsuspendPurposeTemplate(
            unsafeBrandId(req.params.id),
            ctx
          );

        setMetadataVersionHeader(res, metadata);

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          activatePurposeTemplateErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates/:id/archive", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { metadata } =
          await purposeTemplateService.archivePurposeTemplate(
            unsafeBrandId(req.params.id),
            ctx
          );

        setMetadataVersionHeader(res, metadata);

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          archivePurposeTemplateErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates/:id/publish", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { metadata } =
          await purposeTemplateService.publishPurposeTemplate(
            unsafeBrandId(req.params.id),
            ctx
          );

        setMetadataVersionHeader(res, metadata);

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          activatePurposeTemplateErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/purposeTemplates/:id/riskAnalysis/answers/:answerId/annotation/documents",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

          const result =
            await purposeTemplateService.addRiskAnalysisTemplateAnswerAnnotationDocument(
              unsafeBrandId(req.params.id),
              req.params.answerId,
              req.body,
              ctx
            );

          setMetadataVersionHeader(res, result.metadata);
          return res
            .status(200)
            .send(annotationDocumentToApiAnnotationDocument(result.data));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            addPurposeTemplateAnswerAnnotationErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send();
        }
      }
    )
    .get(
      "/purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents/:documentId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          validateAuthorization(ctx, [
            ADMIN_ROLE,
            API_ROLE,
            M2M_ADMIN_ROLE,
            M2M_ROLE,
            SECURITY_ROLE,
            SUPPORT_ROLE,
          ]);

          const { purposeTemplateId, answerId, documentId } = req.params;
          const { data: annotationDocument, metadata } =
            await purposeTemplateService.getRiskAnalysisTemplateAnswerAnnotationDocument(
              {
                purposeTemplateId: unsafeBrandId(purposeTemplateId),
                answerId: unsafeBrandId(answerId),
                documentId: unsafeBrandId(documentId),
              },
              ctx
            );

          setMetadataVersionHeader(res, metadata);

          return res
            .status(200)
            .send(
              purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationDocument.parse(
                annotationDocumentToApiAnnotationDocument(annotationDocument)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getRiskAnalysisTemplateAnswerAnnotationDocumentErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/purposeTemplates/:id/riskAnalysis/answers", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { data: riskAnalysisAnswer, metadata } =
          await purposeTemplateService.createRiskAnalysisAnswer(
            unsafeBrandId(req.params.id),
            req.body,
            ctx
          );

        setMetadataVersionHeader(res, metadata);

        return res
          .status(200)
          .send(riskAnalysisAnswerToApiRiskAnalysisAnswer(riskAnalysisAnswer));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createRiskAnalysisAnswerErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .put(
      "/purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

          const { data: riskAnalysisAnswerAnnotation, metadata } =
            await purposeTemplateService.addRiskAnalysisAnswerAnnotation(
              unsafeBrandId(req.params.purposeTemplateId),
              unsafeBrandId(req.params.answerId),
              req.body,
              ctx
            );

          setMetadataVersionHeader(res, metadata);

          return res
            .status(200)
            .send(
              purposeTemplateAnswerAnnotationToApiPurposeTemplateAnswerAnnotation(
                riskAnalysisAnswerAnnotation
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            addRiskAnalysisAnswerAnnotationErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

          const { metadata } =
            await purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotation(
              {
                purposeTemplateId: unsafeBrandId(req.params.purposeTemplateId),
                answerId: unsafeBrandId(req.params.answerId),
                ctx,
              }
            );

          setMetadataVersionHeader(res, metadata);

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteRiskAnalysisTemplateAnswerAnnotationErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents/:documentId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

          const { metadata } =
            await purposeTemplateService.deleteRiskAnalysisTemplateAnswerAnnotationDocument(
              {
                purposeTemplateId: unsafeBrandId(req.params.purposeTemplateId),
                answerId: unsafeBrandId(req.params.answerId),
                documentId: unsafeBrandId(req.params.documentId),
                ctx,
              }
            );

          setMetadataVersionHeader(res, metadata);

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteRiskAnalysisTemplateAnswerAnnotationDocumentErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/purposeTemplates/:purposeTemplateId/riskAnalysis/answers/:answerId/annotation/documents/:documentId/update",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

          const { data: updatedDocument, metadata } =
            await purposeTemplateService.updateRiskAnalysisTemplateAnswerAnnotationDocument(
              unsafeBrandId(req.params.purposeTemplateId),
              unsafeBrandId(req.params.answerId),
              unsafeBrandId(req.params.documentId),
              req.body,
              ctx
            );

          setMetadataVersionHeader(res, metadata);
          return res
            .status(200)
            .send(annotationDocumentToApiAnnotationDocument(updatedDocument));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateRiskAnalysisTemplateAnswerAnnotationDocumentErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get("/purposeTemplates/:purposeTemplateId/document", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, SUPPORT_ROLE]);

        const document =
          await purposeTemplateService.getRiskAnalysisTemplateDocument(
            unsafeBrandId(req.params.purposeTemplateId),
            ctx
          );
        return res
          .status(200)
          .send(
            purposeTemplateApi.RiskAnalysisTemplateDocument.parse(
              riskAnalysisTemplateDocumentToApiRiskAnalysisTemplateDocument(
                document
              )
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getRiskAnalysisTemplateDocumentErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/purposeTemplates/:purposeTemplateId/signedDocument",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, SUPPORT_ROLE]);

          const document =
            await purposeTemplateService.getRiskAnalysisTemplateSignedDocument(
              unsafeBrandId(req.params.purposeTemplateId),
              ctx
            );
          return res
            .status(200)
            .send(
              purposeTemplateApi.RiskAnalysisTemplateSignedDocument.parse(
                riskAnalysisTemplateSignedDocumentToApiRiskAnalysisTemplateSignedDocument(
                  document
                )
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getRiskAnalysisTemplateSignedDocumentErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/internal/purposeTemplates/:purposeTemplateId/riskAnalysisDocument",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);
          const { purposeTemplateId } = req.params;
          const riskAnalysisTemplateDocument =
            RiskAnalysisTemplateDocument.parse(req.body);

          await purposeTemplateService.internalAddUnsignedRiskAnalysisTemplateDocumentMetadata(
            unsafeBrandId(purposeTemplateId),
            riskAnalysisTemplateDocument,
            ctx
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            addRiskAnalysisTemplateDocumentErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/internal/purposeTemplates/:purposeTemplateId/riskAnalysisDocument/signed",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);
          const { purposeTemplateId } = req.params;
          const riskAnalysisTemplateSignedDocument =
            RiskAnalysisTemplateSignedDocument.parse(req.body);

          await purposeTemplateService.internalAddSignedRiskAnalysisTemplateDocumentMetadata(
            unsafeBrandId(purposeTemplateId),
            riskAnalysisTemplateSignedDocument,
            ctx
          );

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            addRiskAnalysisTemplateDocumentErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return purposeTemplateRouter;
};

export default purposeTemplateRouter;
