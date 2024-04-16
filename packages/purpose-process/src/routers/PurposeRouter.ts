import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
  ReadModelRepository,
  initDB,
} from "pagopa-interop-commons";
import { unsafeBrandId } from "pagopa-interop-models";
import { api } from "../model/generated/api.js";
import {
  purposeToApiPurpose,
  purposeVersionDocumentToApiPurposeVersionDocument,
} from "../model/domain/apiConverter.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { config } from "../utilities/config.js";
import { purposeServiceBuilder } from "../services/purposeService.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  deletePurposeVersionErrorMapper,
  getPurposeErrorMapper,
  getRiskAnalysisDocumentErrorMapper,
  rejectPurposeVersionErrorMapper,
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
  const purposeRouter = ctx.router(api.api);
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
      (_req, res) => res.status(501).send()
    )
    .post("/purposes", authorizationMiddleware([ADMIN_ROLE]), (_req, res) =>
      res.status(501).send()
    )
    .post(
      "/reverse/purposes",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
    )
    .post(
      "/reverse/purposes/:id",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
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
    .post("/purposes/:id", authorizationMiddleware([ADMIN_ROLE]), (_req, res) =>
      res.status(501).send()
    )
    .delete(
      "/purposes/:id",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
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
      (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/suspend",
      authorizationMiddleware([ADMIN_ROLE]),
      (_req, res) => res.status(501).send()
    )
    .post(
      "/purposes/:purposeId/versions/:versionId/archive",
      authorizationMiddleware([ADMIN_ROLE, INTERNAL_ROLE]),
      (_req, res) => res.status(501).send()
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
      (_req, res) => res.status(501).send()
    );

  return purposeRouter;
};
export default purposeRouter;
