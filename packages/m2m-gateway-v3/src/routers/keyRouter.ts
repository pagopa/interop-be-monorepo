import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
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
import { KeyService } from "../services/keyService.js";

const keyRouter = (
  ctx: ZodiosContext,
  keyService: KeyService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const keyRouter = ctx.router(m2mGatewayApiV3.keysApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const { M2M_ADMIN_ROLE, M2M_ROLE } = authRole;

  keyRouter
    .get("/keys/:kid", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const key = await keyService.getKey(req.params.kid, ctx);

        return res.status(200).send(m2mGatewayApiV3.Key.parse(key));
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
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const key = await keyService.getProducerKey(req.params.kid, ctx);

        return res.status(200).send(m2mGatewayApiV3.ProducerKey.parse(key));
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

  return keyRouter;
};

export default keyRouter;
