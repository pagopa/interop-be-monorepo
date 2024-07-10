import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";

const selfcareRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const selfcareRouter = ctx.router(bffApi.selfcareApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  selfcareRouter
    .get("/users/:userId", async (_req, res) => res.status(501).send())
    .get("/selfcare/institutions/products", async (_req, res) =>
      res.status(501).send()
    )
    .get("/tenants/:tenantId/users", async (_req, res) =>
      res.status(501).send()
    )
    .get("/selfcare/institutions", async (_req, res) => res.status(501).send());

  return selfcareRouter;
};

export default selfcareRouter;
