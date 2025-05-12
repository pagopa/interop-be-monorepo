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
import { EserviceService } from "../services/eserviceService.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";

const eserviceRouter = (
  ctx: ZodiosContext,
  eserviceService: EserviceService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const eserviceRouter = ctx.router(m2mGatewayApi.eservicesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  void eserviceService;

  eserviceRouter
    .get("/eservices", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving eservices`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/eservices/:eserviceId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving eservice with id ${req.params.eserviceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/eservices/:eserviceId/descriptors", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving eservice ${req.params.eserviceId} descriptors`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/eservices/:eserviceId/descriptors/:descriptorId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          return res.status(501).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error retrieving eservice ${req.params.eserviceId} descriptor with id ${req.params.descriptorId}`
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return eserviceRouter;
};

export default eserviceRouter;
