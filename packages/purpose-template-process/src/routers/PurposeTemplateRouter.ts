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
import { EServiceId, TenantId, unsafeBrandId } from "pagopa-interop-models";
import { PurposeTemplateService } from "../services/purposeTemplateService.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  addRiskAnalysisAnswerAnnotationErrorMapper,
  createPurposeTemplateErrorMapper,
  getPurposeTemplateErrorMapper,
  getPurposeTemplateEServiceDescriptorsErrorMapper,
  getPurposeTemplatesErrorMapper,
  getRiskAnalysisTemplateAnswerAnnotationDocumentErrorMapper,
  linkEservicesToPurposeTemplateErrorMapper,
  publishPurposeTemplateErrorMapper,
  unlinkEServicesFromPurposeTemplateErrorMapper,
  updatePurposeTemplateErrorMapper,
  addPurposeTemplateAnswerAnnotationErrorMapper,
  createRiskAnalysisAnswerErrorMapper,
} from "../utilities/errorMappers.js";
import {
  annotationDocumentToApiAnnotationDocument,
  apiPurposeTemplateStateToPurposeTemplateState,
  eserviceDescriptorPurposeTemplateToApiEServiceDescriptorPurposeTemplate,
  purposeTemplateAnswerAnnotationToApiPurposeTemplateAnswerAnnotation,
  purposeTemplateToApiPurposeTemplate,
  riskAnalysisAnswerToApiRiskAnalysisAnswer,
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
      } catch (error) {
        return res.status(501);
      }
      return res.status(501);
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

        const { producerIds, eserviceIds, offset, limit } = req.query;
        const purposeTemplateEServicesDescriptors =
          await purposeTemplateService.getPurposeTemplateEServiceDescriptors(
            {
              purposeTemplateId: unsafeBrandId(req.params.id),
              producerIds: producerIds?.map(unsafeBrandId<TenantId>),
              eserviceIds: eserviceIds?.map(unsafeBrandId<EServiceId>),
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

        return res
          .status(200)
          .send(
            eserviceDescriptorPurposeTemplates.map(
              (eserviceDescriptorPurposeTemplate) =>
                eserviceDescriptorPurposeTemplateToApiEServiceDescriptorPurposeTemplate(
                  eserviceDescriptorPurposeTemplate
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

        await purposeTemplateService.unlinkEservicesFromPurposeTemplate(
          unsafeBrandId(req.params.id),
          req.body.eserviceIds.map(unsafeBrandId<EServiceId>),
          ctx
        );
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
      } catch (error) {
        return res.status(501);
      }
      return res.status(501);
    })
    .post("/purposeTemplates/:id/unsuspend", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);
      } catch (error) {
        return res.status(501);
      }
      return res.status(501);
    })
    .post("/purposeTemplates/:id/archive", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);
      } catch (error) {
        return res.status(501);
      }
      return res.status(501);
    })
    .post("/purposeTemplates/:id/publish", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { data: purposeTemplate, metadata } =
          await purposeTemplateService.publishPurposeTemplate(
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
          publishPurposeTemplateErrorMapper,
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
    );

  return purposeTemplateRouter;
};

export default purposeTemplateRouter;
