/* eslint-disable sonarjs/no-identical-functions */
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  authRole,
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  validateAuthorization,
} from "pagopa-interop-commons";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";
import { PurposeTemplateService } from "../services/purposeTemplateService.js";

const purposeTemplateRouter = (
  ctx: ZodiosContext,
  purposeTemplateService: PurposeTemplateService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const { M2M_ADMIN_ROLE, M2M_ROLE } = authRole;

  const purposeTemplateRouter = ctx.router(
    m2mGatewayApi.purposeTemplatesApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );

  purposeTemplateRouter
    .get("/purposeTemplates", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const purposeTemplates =
          await purposeTemplateService.getPurposeTemplates(req.query, ctx);

        return res
          .status(200)
          .send(m2mGatewayApi.PurposeTemplates.parse(purposeTemplates));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving purpose templates`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/purposeTemplates/:purposeTemplateId/publish", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const purposeTemplate =
          await purposeTemplateService.publishPurposeTemplate(
            unsafeBrandId(req.params.purposeTemplateId),
            ctx
          );

        return res
          .status(200)
          .send(m2mGatewayApi.PurposeTemplate.parse(purposeTemplate));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error suspending purpose template ${req.params.purposeTemplateId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/purposeTemplates/:purposeTemplateId/unsuspend",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

        try {
          validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

          const purposeTemplate =
            await purposeTemplateService.unsuspendPurposeTemplate(
              unsafeBrandId(req.params.purposeTemplateId),
              ctx
            );

          return res
            .status(200)
            .send(m2mGatewayApi.PurposeTemplate.parse(purposeTemplate));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error unsuspending purpose template ${req.params.purposeTemplateId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return purposeTemplateRouter;
};

export default purposeTemplateRouter;
