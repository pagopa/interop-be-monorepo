import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
  ReadModelRepository,
  initDB,
  initFileManager,
  fromAppContext,
  initPDFGenerator,
  authRole,
  validateAuthorization,
} from "pagopa-interop-commons";
import {
  EServiceId,
  TenantId,
  emptyErrorMapper,
  unsafeBrandId,
} from "pagopa-interop-models";
import { purposeApi } from "pagopa-interop-api-clients";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  delegationReadModelServiceBuilder,
  makeDrizzleConnection,
  purposeReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  apiPurposeVersionStateToPurposeVersionState,
  purposeToApiPurpose,
  purposeVersionDocumentToApiPurposeVersionDocument,
  purposeVersionToApiPurposeVersion,
  riskAnalysisFormConfigToApiRiskAnalysisFormConfig,
} from "../model/domain/apiConverter.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { config } from "../config/config.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  activatePurposeVersionErrorMapper,
  archivePurposeVersionErrorMapper,
  createPurposeVersionErrorMapper,
  clonePurposeErrorMapper,
  createPurposeErrorMapper,
  createReversePurposeErrorMapper,
  deletePurposeErrorMapper,
  deletePurposeVersionErrorMapper,
  getPurposeErrorMapper,
  getRiskAnalysisDocumentErrorMapper,
  rejectPurposeVersionErrorMapper,
  retrieveRiskAnalysisConfigurationByVersionErrorMapper,
  suspendPurposeVersionErrorMapper,
  updatePurposeErrorMapper,
  updateReversePurposeErrorMapper,
  getPurposesErrorMapper,
} from "../utilities/errorMappers.js";
import { purposeServiceBuilder } from "../services/purposeService.js";
import { readModelServiceBuilderSQL } from "../services/readModelServiceSQL.js";

const readModelDB = makeDrizzleConnection(config);
const purposeReadModelServiceSQL = purposeReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const delegationReadModelServiceSQL =
  delegationReadModelServiceBuilder(readModelDB);

const oldReadModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);
const readModelServiceSQL = readModelServiceBuilderSQL({
  readModelDB,
  purposeReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  agreementReadModelServiceSQL,
  delegationReadModelServiceSQL,
});
const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

const fileManager = initFileManager(config);
const pdfGenerator = await initPDFGenerator();

const purposeService = purposeServiceBuilder(
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
  fileManager,
  pdfGenerator
);

const purposeRouter = (
  ctx: ZodiosContext
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
        ]);

        const {
          name,
          eservicesIds,
          consumersIds,
          producersIds,
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
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const { purpose, isRiskAnalysisValid } =
          await purposeService.createPurpose(req.body, ctx);
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
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const { purpose, isRiskAnalysisValid } =
          await purposeService.createReversePurpose(req.body, ctx);
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

        const { purpose, isRiskAnalysisValid } =
          await purposeService.updateReversePurpose(
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
    .get("/purposes/:id", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          SUPPORT_ROLE,
        ]);

        const { purpose, isRiskAnalysisValid } =
          await purposeService.getPurposeById(
            unsafeBrandId(req.params.id),
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
        const errorRes = makeApiProblem(error, getPurposeErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposes/:id", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const { purpose, isRiskAnalysisValid } =
          await purposeService.updatePurpose(
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
    .delete("/purposes/:id", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

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
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const purposeVersion = await purposeService.createPurposeVersion(
          unsafeBrandId(req.params.purposeId),
          req.body,
          ctx
        );
        return res
          .status(200)
          .send(
            purposeApi.PurposeVersion.parse(
              purposeVersionToApiPurposeVersion(purposeVersion)
            )
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
        validateAuthorization(ctx, [ADMIN_ROLE]);

        await purposeService.deletePurposeVersion(
          {
            purposeId: unsafeBrandId(req.params.purposeId),
            versionId: unsafeBrandId(req.params.versionId),
          },
          ctx
        );
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
          validateAuthorization(ctx, [ADMIN_ROLE]);

          const { purposeId, versionId } = req.params;
          const purposeVersion = await purposeService.activatePurposeVersion(
            {
              purposeId: unsafeBrandId(purposeId),
              versionId: unsafeBrandId(versionId),
            },
            ctx
          );
          return res
            .status(200)
            .send(
              purposeApi.PurposeVersion.parse(
                purposeVersionToApiPurposeVersion(purposeVersion)
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
          validateAuthorization(ctx, [ADMIN_ROLE]);

          const suspendedVersion = await purposeService.suspendPurposeVersion(
            {
              purposeId: unsafeBrandId(req.params.purposeId),
              versionId: unsafeBrandId(req.params.versionId),
            },
            ctx
          );
          return res
            .status(200)
            .send(
              purposeApi.PurposeVersion.parse(
                purposeVersionToApiPurposeVersion(suspendedVersion)
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
          validateAuthorization(ctx, [ADMIN_ROLE]);

          const archivedVersion = await purposeService.archivePurposeVersion(
            {
              purposeId: unsafeBrandId(req.params.purposeId),
              versionId: unsafeBrandId(req.params.versionId),
            },
            ctx
          );
          return res
            .status(200)
            .send(
              purposeApi.PurposeVersion.parse(
                purposeVersionToApiPurposeVersion(archivedVersion)
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
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
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
    );

  return purposeRouter;
};
export default purposeRouter;
