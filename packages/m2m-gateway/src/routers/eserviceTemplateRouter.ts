import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  authRole,
  validateAuthorization,
} from "pagopa-interop-commons";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { EserviceTemplateService } from "../services/eserviceTemplateService.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";
import { getEServiceTemplateVersionErrorMapper } from "../utils/errorMappers.js";

const eserviceTemplateRouter = (
  ctx: ZodiosContext,
  eserviceTemplateService: EserviceTemplateService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const { M2M_ROLE, M2M_ADMIN_ROLE } = authRole;

  const eserviceTemplateRouter = ctx.router(
    m2mGatewayApi.eserviceTemplatesApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );

  eserviceTemplateRouter
    .get("/eserviceTemplates/:templateId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const template = await eserviceTemplateService.getEServiceTemplateById(
          unsafeBrandId(req.params.templateId),
          ctx
        );

        return res
          .status(200)
          .send(m2mGatewayApi.EServiceTemplate.parse(template));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving eservice template with id ${req.params.templateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/eserviceTemplates/:templateId/versions", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const versions =
          await eserviceTemplateService.getEServiceTemplateVersions(
            unsafeBrandId(req.params.templateId),
            req.query,
            ctx
          );

        return res
          .status(200)
          .send(m2mGatewayApi.EServiceTemplateVersions.parse(versions));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving eservice template ${req.params.templateId} versions`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/eserviceTemplates/:templateId/versions/:versionId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

          const version =
            await eserviceTemplateService.getEServiceTemplateVersion(
              unsafeBrandId(req.params.templateId),
              unsafeBrandId(req.params.versionId),
              ctx
            );

          return res
            .status(200)
            .send(m2mGatewayApi.EServiceTemplateVersion.parse(version));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getEServiceTemplateVersionErrorMapper,
            ctx,
            `Error retrieving eservice template ${req.params.templateId} version ${req.params.versionId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return eserviceTemplateRouter;
};

export default eserviceTemplateRouter;
