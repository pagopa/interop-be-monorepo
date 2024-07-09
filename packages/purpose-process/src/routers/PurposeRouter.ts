import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
  zodiosValidationErrorToApiProblem,
  ReadModelRepository,
  initDB,
  initFileManager,
  fromAppContext,
  initPDFGenerator,
} from "pagopa-interop-commons";
import { EServiceId, TenantId, unsafeBrandId } from "pagopa-interop-models";
import { purposeApi } from "pagopa-interop-api-clients";
import {
  apiPurposeVersionStateToPurposeVersionState,
  purposeToApiPurpose,
  purposeVersionDocumentToApiPurposeVersionDocument,
  purposeVersionToApiPurposeVersion,
  riskAnalysisFormConfigToApiRiskAnalysisFormConfig,
} from "../model/domain/apiConverter.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { config } from "../utilities/config.js";
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
} from "../utilities/errorMappers.js";
import { purposeServiceBuilder } from "../services/purposeService.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);
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
  } = userRoles;
  purposeRouter
    .get(
      "/purposes",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        INTERNAL_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
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
            req.ctx.authData.organizationId,
            {
              title: name,
              eservicesIds: eservicesIds?.map(unsafeBrandId<EServiceId>),
              consumersIds: consumersIds?.map(unsafeBrandId<TenantId>),
              producersIds: producersIds?.map(unsafeBrandId<TenantId>),
              states: states?.map(apiPurposeVersionStateToPurposeVersionState),
              excludeDraft,
            },
            { offset, limit },
            ctx.logger
          );
          return res
            .status(200)
            .json({
              results: purposes.results.map((purpose) =>
                purposeToApiPurpose(purpose, false)
              ),
              totalCount: purposes.totalCount,
            })
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(error, () => 500, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/purposes",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { purpose, isRiskAnalysisValid } =
            await purposeService.createPurpose(
              req.body,
              req.ctx.authData.organizationId,
              req.ctx.correlationId,
              ctx.logger
            );
          return res
            .status(200)
            .json(purposeToApiPurpose(purpose, isRiskAnalysisValid))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createPurposeErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/reverse/purposes",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { purpose, isRiskAnalysisValid } =
            await purposeService.createReversePurpose(
              req.ctx.authData.organizationId,
              req.body,
              ctx.correlationId,
              ctx.logger
            );
          return res
            .status(200)
            .json(purposeToApiPurpose(purpose, isRiskAnalysisValid))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createReversePurposeErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/reverse/purposes/:id",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { purpose, isRiskAnalysisValid } =
            await purposeService.updateReversePurpose({
              purposeId: unsafeBrandId(req.params.id),
              reversePurposeUpdateContent: req.body,
              organizationId: req.ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
              logger: ctx.logger,
            });
          return res
            .status(200)
            .json(purposeToApiPurpose(purpose, isRiskAnalysisValid))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updateReversePurposeErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/purposes/:id",
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
          const { purpose, isRiskAnalysisValid } =
            await purposeService.getPurposeById(
              unsafeBrandId(req.params.id),
              ctx.authData.organizationId,
              ctx.logger
            );
          return res
            .status(200)
            .json(purposeToApiPurpose(purpose, isRiskAnalysisValid))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getPurposeErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/purposes/:id",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { purpose, isRiskAnalysisValid } =
            await purposeService.updatePurpose({
              purposeId: unsafeBrandId(req.params.id),
              purposeUpdateContent: req.body,
              organizationId: req.ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
              logger: ctx.logger,
            });
          return res
            .status(200)
            .json(purposeToApiPurpose(purpose, isRiskAnalysisValid))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            updatePurposeErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete(
      "/purposes/:id",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await purposeService.deletePurpose({
            purposeId: unsafeBrandId(req.params.id),
            organizationId: req.ctx.authData.organizationId,
            correlationId: req.ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deletePurposeErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const purposeVersion = await purposeService.createPurposeVersion({
            purposeId: unsafeBrandId(req.params.purposeId),
            seed: req.body,
            organizationId: req.ctx.authData.organizationId,
            correlationId: req.ctx.correlationId,
            logger: ctx.logger,
          });
          return res
            .status(200)
            .json(purposeVersionToApiPurposeVersion(purposeVersion))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createPurposeVersionErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete(
      "/purposes/:purposeId/versions/:versionId",
      authorizationMiddleware([ADMIN_ROLE, INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await purposeService.deletePurposeVersion({
            purposeId: unsafeBrandId(req.params.purposeId),
            versionId: unsafeBrandId(req.params.versionId),
            organizationId: req.ctx.authData.organizationId,
            correlationId: req.ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deletePurposeVersionErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/purposes/:purposeId/versions/:versionId/documents/:documentId",
      authorizationMiddleware([ADMIN_ROLE, SUPPORT_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const document = await purposeService.getRiskAnalysisDocument({
            purposeId: unsafeBrandId(req.params.purposeId),
            versionId: unsafeBrandId(req.params.versionId),
            documentId: unsafeBrandId(req.params.documentId),
            organizationId: req.ctx.authData.organizationId,
            logger: ctx.logger,
          });
          return res
            .status(200)
            .json(purposeVersionDocumentToApiPurposeVersionDocument(document))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getRiskAnalysisDocumentErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/reject",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await purposeService.rejectPurposeVersion({
            purposeId: unsafeBrandId(req.params.purposeId),
            versionId: unsafeBrandId(req.params.versionId),
            organizationId: req.ctx.authData.organizationId,
            rejectionReason: req.body.rejectionReason,
            correlationId: req.ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            rejectPurposeVersionErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/activate",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { purposeId, versionId } = req.params;
          const purposeVersion = await purposeService.activatePurposeVersion({
            purposeId: unsafeBrandId(purposeId),
            versionId: unsafeBrandId(versionId),
            organizationId: req.ctx.authData.organizationId,
            correlationId: req.ctx.correlationId,
            logger: ctx.logger,
          });
          return res
            .status(200)
            .json(purposeVersionToApiPurposeVersion(purposeVersion))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            activatePurposeVersionErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/purposes/:purposeId/clone",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { purpose, isRiskAnalysisValid } =
            await purposeService.clonePurpose({
              purposeId: unsafeBrandId(req.params.purposeId),
              organizationId: req.ctx.authData.organizationId,
              seed: req.body,
              correlationId: req.ctx.correlationId,
              logger: ctx.logger,
            });
          return res
            .status(200)
            .json(purposeToApiPurpose(purpose, isRiskAnalysisValid))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            clonePurposeErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/suspend",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const suspendedVersion = await purposeService.suspendPurposeVersion({
            purposeId: unsafeBrandId(req.params.purposeId),
            versionId: unsafeBrandId(req.params.versionId),
            organizationId: req.ctx.authData.organizationId,
            correlationId: req.ctx.correlationId,
            logger: ctx.logger,
          });
          return res
            .status(200)
            .json(purposeVersionToApiPurposeVersion(suspendedVersion))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            suspendPurposeVersionErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/archive",
      authorizationMiddleware([ADMIN_ROLE, INTERNAL_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const archivedVersion = await purposeService.archivePurposeVersion({
            purposeId: unsafeBrandId(req.params.purposeId),
            versionId: unsafeBrandId(req.params.versionId),
            organizationId: req.ctx.authData.organizationId,
            correlationId: req.ctx.correlationId,
            logger: ctx.logger,
          });
          return res
            .status(200)
            .json(purposeVersionToApiPurposeVersion(archivedVersion))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            archivePurposeVersionErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/purposes/riskAnalysis/latest",
      authorizationMiddleware([ADMIN_ROLE, SUPPORT_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const riskAnalysisConfiguration =
            await purposeService.retrieveLatestRiskAnalysisConfiguration({
              tenantKind: req.query.tenantKind,
              organizationId: req.ctx.authData.organizationId,
              logger: ctx.logger,
            });
          return res
            .status(200)
            .json(
              riskAnalysisFormConfigToApiRiskAnalysisFormConfig(
                riskAnalysisConfiguration
              )
            )
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(error, () => 500, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/purposes/riskAnalysis/version/:riskAnalysisVersion",
      authorizationMiddleware([ADMIN_ROLE, SUPPORT_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const riskAnalysisConfiguration =
            await purposeService.retrieveRiskAnalysisConfigurationByVersion({
              eserviceId: unsafeBrandId(req.query.eserviceId),
              riskAnalysisVersion: req.params.riskAnalysisVersion,
              organizationId: req.ctx.authData.organizationId,
              logger: ctx.logger,
            });
          return res
            .status(200)
            .json(
              riskAnalysisFormConfigToApiRiskAnalysisFormConfig(
                riskAnalysisConfiguration
              )
            )
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            retrieveRiskAnalysisConfigurationByVersionErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    );

  return purposeRouter;
};
export default purposeRouter;
