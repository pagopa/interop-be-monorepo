import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { purposeApi } from "pagopa-interop-api-clients";
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
  ClientId,
  DelegationId,
  EServiceId,
  PurposeTemplateId,
  PurposeVersionDocument,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  apiPurposeSignedRiskAnalisysToPurposeSignedRiskAnalisys,
  apiPurposeVersionStateToPurposeVersionState,
  purposeToApiPurpose,
  purposeVersionDocumentToApiPurposeVersionDocument,
  purposeVersionSignedDocumentToApiPurposeVersionSignedDocument,
  purposeVersionToApiPurposeVersion,
  riskAnalysisFormConfigToApiRiskAnalysisFormConfig,
} from "../model/domain/apiConverter.js";
import { makeApiProblem } from "../model/domain/errors.js";
import { PurposeService } from "../services/purposeService.js";
import {
  activatePurposeVersionErrorMapper,
  archivePurposeVersionErrorMapper,
  clonePurposeErrorMapper,
  createPurposeErrorMapper,
  createPurposeFromTemplateErrorMapper,
  createPurposeVersionErrorMapper,
  createReversePurposeErrorMapper,
  deletePurposeErrorMapper,
  deletePurposeVersionErrorMapper,
  generateRiskAnalysisDocumentErrorMapper,
  generateRiskAnalysisSignedDocumentErrorMapper,
  getPurposeErrorMapper,
  getPurposesErrorMapper,
  getRiskAnalysisDocumentErrorMapper,
  rejectPurposeVersionErrorMapper,
  retrieveLatestRiskAnalysisConfigurationErrorMapper,
  retrieveRiskAnalysisConfigurationByVersionErrorMapper,
  suspendPurposeVersionErrorMapper,
  updatePurposeByTemplateErrorMapper,
  updatePurposeErrorMapper,
  updateReversePurposeErrorMapper,
} from "../utilities/errorMappers.js";

const purposeRouter = (
  ctx: ZodiosContext,
  purposeService: PurposeService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const purposeRouter = ctx.router(purposeApi.purposeApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  const {
    ADMIN_ROLE,
    API_ROLE,
    SECURITY_ROLE,
    M2M_ROLE,
    INTERNAL_ROLE,
    SUPPORT_ROLE,
    M2M_ADMIN_ROLE,
  } = authRole;
  purposeRouter
    .get("/purposes", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          SUPPORT_ROLE,
          M2M_ADMIN_ROLE,
        ]);

        const {
          name,
          eservicesIds,
          consumersIds,
          producersIds,
          clientId,
          states,
          excludeDraft,
          offset,
          limit,
        } = req.query;
        const purposes = await purposeService.getPurposes(
          {
            title: name,
            eservicesIds: eservicesIds?.map(unsafeBrandId<EServiceId>),
            consumersIds: consumersIds?.map(unsafeBrandId<TenantId>),
            producersIds: producersIds?.map(unsafeBrandId<TenantId>),
            clientId: clientId ? unsafeBrandId<ClientId>(clientId) : undefined,
            states: states?.map(apiPurposeVersionStateToPurposeVersionState),
            excludeDraft,
          },
          { offset, limit },
          ctx
        );
        return res.status(200).send(
          purposeApi.Purposes.parse({
            results: purposes.results.map((purpose) =>
              purposeToApiPurpose(purpose, false)
            ),
            totalCount: purposes.totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(error, getPurposesErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposes", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const {
          data: { purpose, isRiskAnalysisValid },
          metadata,
        } = await purposeService.createPurpose(req.body, ctx);

        setMetadataVersionHeader(res, metadata);

        return res
          .status(200)
          .send(
            purposeApi.Purpose.parse(
              purposeToApiPurpose(purpose, isRiskAnalysisValid)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(error, createPurposeErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/reverse/purposes", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const {
          data: { purpose, isRiskAnalysisValid },
          metadata,
        } = await purposeService.createReversePurpose(req.body, ctx);

        setMetadataVersionHeader(res, metadata);

        return res
          .status(200)
          .send(
            purposeApi.Purpose.parse(
              purposeToApiPurpose(purpose, isRiskAnalysisValid)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createReversePurposeErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/reverse/purposes/:id", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const {
          data: { purpose, isRiskAnalysisValid },
        } = await purposeService.updateReversePurpose(
          unsafeBrandId(req.params.id),
          req.body,
          ctx
        );
        return res
          .status(200)
          .send(
            purposeApi.Purpose.parse(
              purposeToApiPurpose(purpose, isRiskAnalysisValid)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          updateReversePurposeErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .patch("/reverse/purposes/:id", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const {
          data: { purpose, isRiskAnalysisValid },
          metadata,
        } = await purposeService.patchUpdateReversePurpose(
          unsafeBrandId(req.params.id),
          req.body,
          ctx
        );

        setMetadataVersionHeader(res, metadata);

        return res
          .status(200)
          .send(
            purposeApi.Purpose.parse(
              purposeToApiPurpose(purpose, isRiskAnalysisValid)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          updateReversePurposeErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/purposes/:id", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          SUPPORT_ROLE,
          M2M_ADMIN_ROLE,
        ]);

        const {
          data: { purpose, isRiskAnalysisValid },
          metadata,
        } = await purposeService.getPurposeById(
          unsafeBrandId(req.params.id),
          ctx
        );

        setMetadataVersionHeader(res, metadata);

        return res
          .status(200)
          .send(
            purposeApi.Purpose.parse(
              purposeToApiPurpose(purpose, isRiskAnalysisValid)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(error, getPurposeErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposes/:id", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const {
          data: { purpose, isRiskAnalysisValid },
        } = await purposeService.updatePurpose(
          unsafeBrandId(req.params.id),
          req.body,
          ctx
        );

        return res
          .status(200)
          .send(
            purposeApi.Purpose.parse(
              purposeToApiPurpose(purpose, isRiskAnalysisValid)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(error, updatePurposeErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .patch("/purposes/:id", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const {
          data: { purpose, isRiskAnalysisValid },
          metadata,
        } = await purposeService.patchUpdatePurpose(
          unsafeBrandId(req.params.id),
          req.body,
          ctx
        );

        setMetadataVersionHeader(res, metadata);

        return res
          .status(200)
          .send(
            purposeApi.Purpose.parse(
              purposeToApiPurpose(purpose, isRiskAnalysisValid)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(error, updatePurposeErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/purposes/:id", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        await purposeService.deletePurpose(unsafeBrandId(req.params.id), ctx);
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, deletePurposeErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete(
      "/internal/delegations/:delegationId/purposes/:id",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);

          await purposeService.internalDeletePurposeAfterDelegationRevocation(
            unsafeBrandId(req.params.id),
            unsafeBrandId(req.params.delegationId),
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(error, deletePurposeErrorMapper, ctx);
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/purposes/:purposeId/versions", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const {
          data: { purpose, isRiskAnalysisValid, createdVersionId },
          metadata,
        } = await purposeService.createPurposeVersion(
          unsafeBrandId(req.params.purposeId),
          req.body,
          ctx
        );

        setMetadataVersionHeader(res, metadata);

        return res.status(200).send(
          purposeApi.CreatedPurposeVersion.parse({
            purpose: purposeToApiPurpose(purpose, isRiskAnalysisValid),
            createdVersionId,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createPurposeVersionErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/purposes/:purposeId/versions/:versionId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { metadata } = await purposeService.deletePurposeVersion(
          {
            purposeId: unsafeBrandId(req.params.purposeId),
            versionId: unsafeBrandId(req.params.versionId),
          },
          ctx
        );

        setMetadataVersionHeader(res, metadata);

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          deletePurposeVersionErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/purposes/:purposeId/versions/:versionId/documents/:documentId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, SUPPORT_ROLE]);

          const document = await purposeService.getRiskAnalysisDocument({
            purposeId: unsafeBrandId(req.params.purposeId),
            versionId: unsafeBrandId(req.params.versionId),
            documentId: unsafeBrandId(req.params.documentId),
            ctx,
          });
          return res
            .status(200)
            .send(
              purposeApi.PurposeVersionDocument.parse(
                purposeVersionDocumentToApiPurposeVersionDocument(document)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getRiskAnalysisDocumentErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/reject",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE]);

          await purposeService.rejectPurposeVersion(
            {
              purposeId: unsafeBrandId(req.params.purposeId),
              versionId: unsafeBrandId(req.params.versionId),
              rejectionReason: req.body.rejectionReason,
            },
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            rejectPurposeVersionErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/activate",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

          const { purposeId, versionId } = req.params;
          const { data, metadata } =
            await purposeService.activatePurposeVersion(
              {
                purposeId: unsafeBrandId(purposeId),
                versionId: unsafeBrandId(versionId),
                delegationId: req.body.delegationId
                  ? unsafeBrandId<DelegationId>(req.body.delegationId)
                  : undefined,
              },
              ctx
            );

          setMetadataVersionHeader(res, metadata);
          return res
            .status(200)
            .send(
              purposeApi.PurposeVersion.parse(
                purposeVersionToApiPurposeVersion(data)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            activatePurposeVersionErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/purposes/:purposeId/clone", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const { purpose, isRiskAnalysisValid } =
          await purposeService.clonePurpose({
            purposeId: unsafeBrandId(req.params.purposeId),
            seed: req.body,
            ctx,
          });
        return res
          .status(200)
          .send(
            purposeApi.Purpose.parse(
              purposeToApiPurpose(purpose, isRiskAnalysisValid)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(error, clonePurposeErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/purposes/:purposeId/versions/:versionId/suspend",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

          const { data, metadata } = await purposeService.suspendPurposeVersion(
            {
              purposeId: unsafeBrandId(req.params.purposeId),
              versionId: unsafeBrandId(req.params.versionId),
              delegationId: req.body.delegationId
                ? unsafeBrandId<DelegationId>(req.body.delegationId)
                : undefined,
            },
            ctx
          );
          setMetadataVersionHeader(res, metadata);
          return res
            .status(200)
            .send(
              purposeApi.PurposeVersion.parse(
                purposeVersionToApiPurposeVersion(data)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            suspendPurposeVersionErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/archive",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

          const { data, metadata } = await purposeService.archivePurposeVersion(
            {
              purposeId: unsafeBrandId(req.params.purposeId),
              versionId: unsafeBrandId(req.params.versionId),
            },
            ctx
          );
          setMetadataVersionHeader(res, metadata);
          return res
            .status(200)
            .send(
              purposeApi.PurposeVersion.parse(
                purposeVersionToApiPurposeVersion(data)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            archivePurposeVersionErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/internal/delegations/:delegationId/purposes/:purposeId/versions/:versionId/archive",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);

          await purposeService.internalArchivePurposeVersionAfterDelegationRevocation(
            {
              purposeId: unsafeBrandId(req.params.purposeId),
              versionId: unsafeBrandId(req.params.versionId),
              delegationId: unsafeBrandId(req.params.delegationId),
            },
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            archivePurposeVersionErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get("/purposes/riskAnalysis/latest", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          SUPPORT_ROLE,
          API_ROLE,
          SECURITY_ROLE,
        ]);

        const riskAnalysisConfiguration =
          await purposeService.retrieveLatestRiskAnalysisConfiguration({
            tenantKind: req.query.tenantKind,
            ctx,
          });
        return res
          .status(200)
          .send(
            purposeApi.RiskAnalysisFormConfigResponse.parse(
              riskAnalysisFormConfigToApiRiskAnalysisFormConfig(
                riskAnalysisConfiguration
              )
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          retrieveLatestRiskAnalysisConfigurationErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/purposes/riskAnalysis/version/:riskAnalysisVersion",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [
            ADMIN_ROLE,
            SUPPORT_ROLE,
            API_ROLE,
            SECURITY_ROLE,
          ]);

          const riskAnalysisConfiguration =
            await purposeService.retrieveRiskAnalysisConfigurationByVersion({
              eserviceId: unsafeBrandId(req.query.eserviceId),
              riskAnalysisVersion: req.params.riskAnalysisVersion,
              ctx,
            });
          return res
            .status(200)
            .send(
              purposeApi.RiskAnalysisFormConfigResponse.parse(
                riskAnalysisFormConfigToApiRiskAnalysisFormConfig(
                  riskAnalysisConfiguration
                )
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            retrieveRiskAnalysisConfigurationByVersionErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/templates/:purposeTemplateId/purposes", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const {
          data: { purpose, isRiskAnalysisValid },
          metadata,
        } = await purposeService.createPurposeFromTemplate(
          unsafeBrandId<PurposeTemplateId>(req.params.purposeTemplateId),
          req.body,
          ctx
        );

        setMetadataVersionHeader(res, metadata);

        return res
          .status(200)
          .send(
            purposeApi.Purpose.parse(
              purposeToApiPurpose(purpose, isRiskAnalysisValid)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createPurposeFromTemplateErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/internal/purposes/:purposeId/versions/:versionId/riskAnalysisDocument",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);
          const { purposeId, versionId } = req.params;
          const riskAnalysisDocument = PurposeVersionDocument.parse(req.body);

          await purposeService.internalAddUnsignedRiskAnalysisDocumentMetadata(
            unsafeBrandId(purposeId),
            unsafeBrandId(versionId),
            riskAnalysisDocument,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            generateRiskAnalysisDocumentErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/internal/purposes/:purposeId/versions/:versionId/riskAnalysisDocument/signed",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);
          const { purposeId, versionId } = req.params;
          const signedRiskAnalysis =
            apiPurposeSignedRiskAnalisysToPurposeSignedRiskAnalisys(req.body);

          await purposeService.internalAddSignedRiskAnalysisDocumentMetadata(
            unsafeBrandId(purposeId),
            unsafeBrandId(versionId),
            signedRiskAnalysis,
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            generateRiskAnalysisSignedDocumentErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .patch(
      "/templates/:purposeTemplateId/purposes/:purposeId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

          const updatedPurpose =
            await purposeService.patchUpdatePurposeFromTemplate(
              unsafeBrandId<PurposeTemplateId>(req.params.purposeTemplateId),
              unsafeBrandId(req.params.purposeId),
              req.body,
              ctx
            );

          setMetadataVersionHeader(res, updatedPurpose.metadata);

          return res
            .status(200)
            .send(
              purposeApi.Purpose.parse(
                purposeToApiPurpose(updatedPurpose.data, true)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updatePurposeByTemplateErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/purposes/:purposeId/versions/:versionId/signedDocuments/:documentId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, SUPPORT_ROLE]);

          const document = await purposeService.getRiskAnalysisSignedDocument({
            purposeId: unsafeBrandId(req.params.purposeId),
            versionId: unsafeBrandId(req.params.versionId),
            documentId: unsafeBrandId(req.params.documentId),
            ctx,
          });
          return res
            .status(200)
            .send(
              purposeApi.PurposeVersionSignedDocument.parse(
                purposeVersionSignedDocumentToApiPurposeVersionSignedDocument(
                  document
                )
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getRiskAnalysisDocumentErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );
  return purposeRouter;
};
export default purposeRouter;
