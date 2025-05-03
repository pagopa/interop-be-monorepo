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
import { AttributeService } from "../services/attributeService.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";

const attributeRouter = (
  ctx: ZodiosContext,
  attributeService: AttributeService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const attributeRouter = ctx.router(m2mGatewayApi.attributesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  void attributeService;

  attributeRouter
    .get("/certifiedAttributes/:attributeId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving certified attribute with id ${req.params.attributeId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/certifiedAttributes", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error creating certified attribute"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return attributeRouter;
};

export default attributeRouter;
