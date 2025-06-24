import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  validateAuthorization,
  authRole,
} from "pagopa-interop-commons";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { ClientService } from "../services/clientService.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";

const { M2M_ADMIN_ROLE } = authRole;

const clientRouter = (
  ctx: ZodiosContext,
  clientService: ClientService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const clientRouter = ctx.router(m2mGatewayApi.clientsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  clientRouter.post("/clients/:clientId/purposes", async (req, res) => {
    const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

    try {
      validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

      await clientService.addClientPurpose(
        unsafeBrandId(req.params.clientId),
        req.body,
        ctx
      );
      return res.status(204).send();
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        emptyErrorMapper,
        ctx,
        `Error adding purpose to client with id ${req.params.clientId}`
      );
      return res.status(errorRes.status).send(errorRes);
    }
  });

  return clientRouter;
};

export default clientRouter;
