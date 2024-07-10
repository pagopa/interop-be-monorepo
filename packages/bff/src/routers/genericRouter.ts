import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";

const authorizationRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const authorizationRouter = ctx.router(bffApi.authorizationApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  authorizationRouter
    .post("/session/tokens", async (_req, res) => res.status(501).send())
    .post("/support", async (_req, res) => res.status(501).send());

  return authorizationRouter;
};

const toolsRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const toolsRouter = ctx.router(bffApi.toolsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  toolsRouter.post("/tools/validateTokenGeneration", async (_req, res) =>
    res.status(501).send()
  );

  return toolsRouter;
};

const supportRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const supportRouter = ctx.router(bffApi.supportApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  supportRouter.post("/session/saml2/tokens", async (_req, res) =>
    res.status(501).send()
  );

  return supportRouter;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default function genericRouter(ctx: ZodiosContext) {
  return [authorizationRouter(ctx), toolsRouter(ctx), supportRouter(ctx)];
}
