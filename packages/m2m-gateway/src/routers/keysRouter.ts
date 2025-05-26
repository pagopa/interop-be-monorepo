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
import { emptyErrorMapper } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";
import { KeysService } from "../services/keysService.js";

const keysRouter = (
  ctx: ZodiosContext,
  authorizationService: KeysService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const keysRouter = ctx.router(m2mGatewayApi.keysApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const { M2M_ADMIN_ROLE } = authRole;

  keysRouter
    .get("/keys/:kid", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const key = await authorizationService.getKey(req.params.kid, ctx);

        return res.status(200).send(m2mGatewayApi.Key.parse(key));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error getting key with id ${req.params.kid}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/producerKeys/:kid", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const key = await authorizationService.getProducerKey(
          req.params.kid,
          ctx
        );

        return res.status(200).send(m2mGatewayApi.ProducerKey.parse(key));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error getting producer key with id ${req.params.kid}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return keysRouter;
};

export default keysRouter;
