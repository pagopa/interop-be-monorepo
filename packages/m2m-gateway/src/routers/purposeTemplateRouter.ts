/* eslint-disable sonarjs/no-identical-functions */
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { emptyErrorMapper } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";

const purposeTemplateRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const purposeTemplateRouter = ctx.router(
    m2mGatewayApi.purposeTemplatesApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );

  purposeTemplateRouter.get("/purposeTemplates", async (req, res) => {
    const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
    try {
      return res.status(501).send();
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        emptyErrorMapper,
        ctx,
        `Error retrieving purposetemplates`
      );
      return res.status(errorRes.status).send(errorRes);
    }
  });

  return purposeTemplateRouter;
};

export default purposeTemplateRouter;
