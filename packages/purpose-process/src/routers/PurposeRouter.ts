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
} from "pagopa-interop-commons";
import { EServiceId, TenantId, unsafeBrandId } from "pagopa-interop-models";
import { api } from "../model/generated/api.js";
import {
  apiPurposeVersionStateToPurposeVersionState,
  purposeToApiPurpose,
  purposeVersionDocumentToApiPurposeVersionDocument,
  purposeVersionToApiPurposeVersion,
  riskAnalysisFormConfigToApiRiskAnalysisFormConfig,
} from "../model/domain/apiConverter.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { config } from "../utilities/config.js";
import { purposeServiceBuilder } from "../services/purposeServiceBuilder.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  archivePurposeVersionErrorMapper,
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
} from "../utilities/errorMappers.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);

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
  readModelService
);

const purposeRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const purposeRouter = ctx.router(api.api, {
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
              name,
              eservicesIds: eservicesIds.map<EServiceId>(unsafeBrandId),
              consumersIds: consumersIds.map<TenantId>(unsafeBrandId),
              producersIds: producersIds.map<TenantId>(unsafeBrandId),
              states: states.map(apiPurposeVersionStateToPurposeVersionState),
              excludeDraft,
            },
            { offset, limit }
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
          const errorRes = makeApiProblem(error, () => 500);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/purposes",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        try {
          const { purpose, isRiskAnalysisValid } =
            await purposeService.createPurpose(
              req.body,
              req.ctx.authData.organizationId,
              req.ctx.correlationId
            );
          return res
            .status(200)
            .json(purposeToApiPurpose(purpose, isRiskAnalysisValid))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(error, createPurposeErrorMapper);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/reverse/purposes",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        try {
          const { purpose, isRiskAnalysisValid } =
            await purposeService.createReversePurpose(
              req.ctx.authData.organizationId,
              req.body,
              req.ctx.correlationId
            );
          return res
            .status(200)
            .json(purposeToApiPurpose(purpose, isRiskAnalysisValid))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createReversePurposeErrorMapper
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/reverse/purposes/:id",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        try {
          const { purpose, isRiskAnalysisValid } =
            await purposeService.updateReversePurpose({
              purposeId: unsafeBrandId(req.params.id),
              reversePurposeUpdateContent: req.body,
              organizationId: req.ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
            });
          return res
            .status(200)
            .json(purposeToApiPurpose(purpose, isRiskAnalysisValid))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(error, updatePurposeErrorMapper);
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
        try {
          const { purpose, isRiskAnalysisValid } =
            await purposeService.getPurposeById(
              unsafeBrandId(req.params.id),
              req.ctx.authData.organizationId
            );
          return res
            .status(200)
            .json(purposeToApiPurpose(purpose, isRiskAnalysisValid))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(error, getPurposeErrorMapper);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/purposes/:id",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        try {
          const { purpose, isRiskAnalysisValid } =
            await purposeService.updatePurpose({
              purposeId: unsafeBrandId(req.params.id),
              purposeUpdateContent: req.body,
              organizationId: req.ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
            });
          return res
            .status(200)
            .json(purposeToApiPurpose(purpose, isRiskAnalysisValid))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(error, updatePurposeErrorMapper);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete(
      "/purposes/:id",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        try {
          await purposeService.deletePurpose({
            purposeId: unsafeBrandId(req.params.id),
            organizationId: req.ctx.authData.organizationId,
            correlationId: req.ctx.correlationId,
          });
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(error, deletePurposeErrorMapper);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
    )
    .delete(
      "/purposes/:purposeId/versions/:versionId",
      authorizationMiddleware([ADMIN_ROLE, INTERNAL_ROLE]),
      async (req, res) => {
        try {
          await purposeService.deletePurposeVersion({
            purposeId: unsafeBrandId(req.params.purposeId),
            versionId: unsafeBrandId(req.params.versionId),
            organizationId: req.ctx.authData.organizationId,
            correlationId: req.ctx.correlationId,
          });
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deletePurposeVersionErrorMapper
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/purposes/:purposeId/versions/:versionId/documents/:documentId",
      authorizationMiddleware([ADMIN_ROLE, SUPPORT_ROLE]),
      async (req, res) => {
        try {
          const document = await purposeService.getRiskAnalysisDocument({
            purposeId: unsafeBrandId(req.params.purposeId),
            versionId: unsafeBrandId(req.params.versionId),
            documentId: unsafeBrandId(req.params.documentId),
            organizationId: req.ctx.authData.organizationId,
          });
          return res
            .status(200)
            .json(purposeVersionDocumentToApiPurposeVersionDocument(document))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getRiskAnalysisDocumentErrorMapper
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/reject",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        try {
          await purposeService.rejectPurposeVersion({
            purposeId: unsafeBrandId(req.params.purposeId),
            versionId: unsafeBrandId(req.params.versionId),
            organizationId: req.ctx.authData.organizationId,
            rejectionReason: req.body.rejectionReason,
            correlationId: req.ctx.correlationId,
          });
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            rejectPurposeVersionErrorMapper
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/activate",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId/clone",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        try {
          const { purpose, isRiskAnalysisValid } =
            await purposeService.clonePurpose({
              purposeId: unsafeBrandId(req.params.purposeId),
              organizationId: req.ctx.authData.organizationId,
              seed: req.body,
              correlationId: req.ctx.correlationId,
            });
          return res
            .status(200)
            .json(purposeToApiPurpose(purpose, isRiskAnalysisValid))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(error, clonePurposeErrorMapper);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/suspend",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        try {
          const suspendedVersion = await purposeService.suspendPurposeVersion({
            purposeId: unsafeBrandId(req.params.purposeId),
            versionId: unsafeBrandId(req.params.versionId),
            organizationId: req.ctx.authData.organizationId,
            correlationId: req.ctx.correlationId,
          });
          return res
            .status(200)
            .json(purposeVersionToApiPurposeVersion(suspendedVersion))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            suspendPurposeVersionErrorMapper
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/archive",
      authorizationMiddleware([ADMIN_ROLE, INTERNAL_ROLE]),
      async (req, res) => {
        try {
          const archivedVersion = await purposeService.archivePurposeVersion({
            purposeId: unsafeBrandId(req.params.purposeId),
            versionId: unsafeBrandId(req.params.versionId),
            organizationId: req.ctx.authData.organizationId,
            correlationId: req.ctx.correlationId,
          });
          return res
            .status(200)
            .json(purposeVersionToApiPurposeVersion(archivedVersion))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            archivePurposeVersionErrorMapper
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/update/waitingForApproval",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
    )
    .get(
      "/purposes/riskAnalysis/latest",
      authorizationMiddleware([ADMIN_ROLE, SUPPORT_ROLE]),
      (_req, res) => res.status(501).send()
    )
    .get(
      "/purposes/riskAnalysis/version/:riskAnalysisVersion",
      authorizationMiddleware([ADMIN_ROLE, SUPPORT_ROLE]),
      async (req, res) => {
        try {
          const riskAnalysisConfiguration =
            await purposeService.retrieveRiskAnalysisConfigurationByVersion({
              eserviceId: unsafeBrandId(req.query.eserviceId),
              riskAnalysisVersion: req.params.riskAnalysisVersion,
              organizationId: req.ctx.authData.organizationId,
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
            retrieveRiskAnalysisConfigurationByVersionErrorMapper
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    );

  return purposeRouter;
};
export default purposeRouter;
