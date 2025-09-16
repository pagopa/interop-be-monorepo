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
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { PurposeTemplateService } from "../services/purposeTemplateService.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  createPurposeTemplateErrorMapper,
  getPurposeTemplatesErrorMapper,
  publishPurposeTemplateErrorMapper,
} from "../utilities/errorMappers.js";
import {
  apiPurposeTemplateStateToPurposeTemplateState,
  purposeTemplateToApiPurposeTemplate,
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
          ADMIN_ROLE,
          API_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
          SECURITY_ROLE,
          SUPPORT_ROLE,
        ]);

        const { purposeTitle, creatorIds, eserviceIds, states, offset, limit } =
          req.query;
        const purposeTemplates =
          await purposeTemplateService.getPurposeTemplates(
            {
              purposeTitle,
              creatorIds: creatorIds?.map(unsafeBrandId<TenantId>),
              eserviceIds: eserviceIds?.map(unsafeBrandId<EServiceId>),
              states: states?.map(
                apiPurposeTemplateStateToPurposeTemplateState
              ),
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
        return res.status(501);
      }
      return res.status(501);
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
          API_ROLE,
          ADMIN_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
          SUPPORT_ROLE,
          SECURITY_ROLE,
        ]);
      } catch (error) {
        return res.status(501);
      }
      return res.status(501);
    })
    .post("/purposeTemplates/:id/eservices", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);
      } catch (error) {
        return res.status(501);
      }
      return res.status(501);
    })
    .delete("/purposeTemplates/:id/eservices", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);
      } catch (error) {
        return res.status(501);
      }
      return res.status(501);
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
    });

  return purposeTemplateRouter;
};

export default purposeTemplateRouter;
