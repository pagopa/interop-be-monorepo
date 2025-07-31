import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { purposeTemplateApi } from "pagopa-interop-api-clients";
import {
  authRole,
  ExpressContext,
  fromAppContext,
  validateAuthorization,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { PurposeTemplateService } from "../services/purposeTemplateService.js";
import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { PurposeTemplateService } from "../services/purposeTemplateService.js";

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
    SECURITY_ROLE,
    M2M_ROLE,
    SUPPORT_ROLE,
    M2M_ADMIN_ROLE,
  } = authRole;

  purposeTemplateRouter
    .get("/purposeTemplates", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [
          API_ROLE,
          ADMIN_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
          SUPPORT_ROLE,
          SECURITY_ROLE,
        ]);
      } catch (error) {
        return res.status(504);
      }
      return res.status(504);
    })
    .post("/purposeTemplates", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);
      } catch (error) {
        return res.status(504);
      }
      return res.status(504);
    })
    .get("/purposeTemplates/eservices", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [
          API_ROLE,
          ADMIN_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
          SUPPORT_ROLE,
          SECURITY_ROLE,
        ]);
      } catch (error) {
        return res.status(504);
      }
      return res.status(504);
    })
    .get("/purposeTemplates/riskAnalysis", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [
          API_ROLE,
          ADMIN_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
          SUPPORT_ROLE,
          SECURITY_ROLE,
        ]);
      } catch (error) {
        return res.status(504);
      }
      return res.status(504);
    })
    .get("/purposeTemplates/:id", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          API_ROLE,
          ADMIN_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
          SUPPORT_ROLE,
          SECURITY_ROLE,
        ]);

        await purposeTemplateService.getPurposeTemplateById(
          unsafeBrandId(req.params.id),
          ctx
        );

        return res.status(501).send(); // Not implemented
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates/:id", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);
      } catch (error) {
        return res.status(504);
      }
      return res.status(504);
    })
    .delete("/purposeTemplates/:id", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);
      } catch (error) {
        return res.status(504);
      }
      return res.status(504);
    })
    .get("/purposeTemplates/:id/riskAnalysis", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [
          API_ROLE,
          ADMIN_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
          SUPPORT_ROLE,
          SECURITY_ROLE,
        ]);
      } catch (error) {
        return res.status(504);
      }
      return res.status(504);
    })
    .post("/purposeTemplates/:id/riskAnalysis", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);
      } catch (error) {
        return res.status(504);
      }
      return res.status(504);
    })
    .get("/purposeTemplates/:id/eservices", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [
          API_ROLE,
          ADMIN_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
          SUPPORT_ROLE,
          SECURITY_ROLE,
        ]);
      } catch (error) {
        return res.status(504);
      }
      return res.status(504);
    })
    .post("/purposeTemplates/:id/eservices", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);
      } catch (error) {
        return res.status(504);
      }
      return res.status(504);
    })
    .delete("/purposeTemplates/:id/eservices", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);
      } catch (error) {
        return res.status(504);
      }
      return res.status(504);
    })
    .post("/purposeTemplates/:id/suspend", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);
      } catch (error) {
        return res.status(504);
      }
      return res.status(504);
    })
    .post("/purposeTemplates/:id/unsuspend", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);
      } catch (error) {
        return res.status(504);
      }
      return res.status(504);
    })
    .post("/purposeTemplates/:id/archive", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);
      } catch (error) {
        return res.status(504);
      }
      return res.status(504);
    })
    .post("/purposeTemplates/:id/activate", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);
      } catch (error) {
        return res.status(504);
      }
      return res.status(504);
    });

  return purposeTemplateRouter;
};

export default purposeTemplateRouter;
