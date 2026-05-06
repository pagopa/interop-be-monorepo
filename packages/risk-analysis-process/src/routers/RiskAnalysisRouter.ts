import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  authRole,
  fromAppContext,
  initDB,
  validateAuthorization,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import {
  emptyErrorMapper,
  unsafeBrandId,
} from "pagopa-interop-models";
import { riskAnalysisApi } from "pagopa-interop-api-clients";
import { config } from "../config/config.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  riskAnalysisServiceBuilder,
  RiskAnalysisService,
} from "../services/riskAnalysisService.js";

const defaultRiskAnalysisService = riskAnalysisServiceBuilder(
  initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  })
);

const toApiRiskAnalysis = (
  riskAnalysis: Awaited<ReturnType<RiskAnalysisService["getRiskAnalysisById"]>>
): riskAnalysisApi.RiskAnalysis => ({
  ...riskAnalysis,
  createdAt: riskAnalysis.createdAt.toISOString(),
});

const riskAnalysisRouter = (
  ctx: ZodiosContext,
  service: RiskAnalysisService = defaultRiskAnalysisService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const router = ctx.router(riskAnalysisApi.processApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const {
    ADMIN_ROLE,
    API_ROLE,
    SECURITY_ROLE,
    SUPPORT_ROLE,
    M2M_ROLE,
    M2M_ADMIN_ROLE,
  } = authRole;

  router
    .post("/risk-analyses/validate", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          SUPPORT_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
        ]);

        const result = await service.validateRiskAnalysis(req.body, ctx);
        return res
          .status(200)
          .send(riskAnalysisApi.RiskAnalysisValidationResponse.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .post("/risk-analyses", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, SECURITY_ROLE]);

        const riskAnalysis = await service.createRiskAnalysis(
          req.body,
          req.ctx.correlationId,
          ctx
        );

        return res
          .status(200)
          .send(riskAnalysisApi.RiskAnalysis.parse(toApiRiskAnalysis(riskAnalysis)));
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/risk-analyses/:riskAnalysisId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          SUPPORT_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
        ]);

        const riskAnalysis = await service.getRiskAnalysisById(
          unsafeBrandId(req.params.riskAnalysisId),
          ctx
        );

        return res
          .status(200)
          .send(riskAnalysisApi.RiskAnalysis.parse(toApiRiskAnalysis(riskAnalysis)));
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .get("/risk-analyses", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          SUPPORT_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
        ]);

        const { results, totalCount } = await service.getRiskAnalyses(
          {
            context: req.query.context,
            eserviceId: req.query.eserviceId,
            templateId: req.query.templateId,
            offset: req.query.offset,
            limit: req.query.limit,
          },
          ctx
        );

        return res.status(200).send(
          riskAnalysisApi.RiskAnalyses.parse({
            totalCount,
            results: results.map(toApiRiskAnalysis),
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .put("/risk-analyses/:riskAnalysisId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, SECURITY_ROLE]);

        const riskAnalysis = await service.updateRiskAnalysis(
          unsafeBrandId(req.params.riskAnalysisId),
          req.body,
          req.ctx.correlationId,
          ctx
        );

        return res
          .status(200)
          .send(riskAnalysisApi.RiskAnalysis.parse(toApiRiskAnalysis(riskAnalysis)));
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .delete("/risk-analyses/:riskAnalysisId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, API_ROLE, SECURITY_ROLE]);

        await service.deleteRiskAnalysis(
          unsafeBrandId(req.params.riskAnalysisId),
          req.ctx.correlationId,
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return router;
};

export default riskAnalysisRouter;
