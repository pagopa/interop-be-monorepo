import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { apiGatewayApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { fromApiGatewayAppContext } from "../utilities/context.js";
import { agreementServiceBuilder } from "../services/agreementService.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { makeApiProblem } from "../models/errors.js";
import { emptyErrorMapper } from "../utilities/errorMappers.js";

const apiGatewayRouter = (
  ctx: ZodiosContext,
  { agreementProcessClient }: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const apiGatewayRouter = ctx.router(apiGatewayApi.gatewayApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const agreementService = agreementServiceBuilder(agreementProcessClient);

  apiGatewayRouter
    .get("/agreements", async (_req, res) => res.status(501).send())
    .get("/agreements/:agreementId", async (req, res) => {
      const ctx = fromApiGatewayAppContext(req.ctx, req.headers);

      try {
        const response = await agreementService.getAgreementById(
          ctx,
          req.params.agreementId
        );

        return res.status(200).json(response).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx.logger);
        return res.status(errorRes.status).json(errorRes).end();
        // TODO ^ this is not compiling: "Argument of type 'Problem' is not assignable to parameter of type 'void'."
        // Why? We have Problem as response in the API GW spec.
      }
    })
    .get("/agreements/:agreementId/attributes", async (_req, res) =>
      res.status(501).send()
    )
    .get("/agreements/:agreementId/purposes", async (_req, res) =>
      res.status(501).send()
    )
    .post("/attributes", async (_req, res) => res.status(501).send())
    .get("/attributes/:attributeId", async (_req, res) =>
      res.status(501).send()
    )
    .get("/clients/:clientId", async (_req, res) => res.status(501).send())
    .get("/eservices", async (_req, res) => res.status(501).send())
    .get("/eservices/:eserviceId", async (_req, res) => res.status(501).send())
    .get("/eservices/:eserviceId/descriptors", async (_req, res) =>
      res.status(501).send()
    )
    .get(
      "/eservices/:eserviceId/descriptors/:descriptorId",
      async (_req, res) => res.status(501).send()
    )
    .get("/events", async (_req, res) => res.status(501).send())
    .get("/events/agreements", async (_req, res) => res.status(501).send())
    .get("/events/eservices", async (_req, res) => res.status(501).send())
    .get("/events/keys", async (_req, res) => res.status(501).send())
    .get("/keys/:kid", async (_req, res) => res.status(501).send())
    .get("/organizations/:organizationId", async (_req, res) =>
      res.status(501).send()
    )
    .get("/purposes", async (_req, res) => res.status(501).send())
    .get("/purposes/:purposeId", async (_req, res) => res.status(501).send())
    .get("/purposes/:purposeId/agreement", async (_req, res) =>
      res.status(501).send()
    )
    .post(
      "/organizations/origin/:origin/externalId/:externalId/attributes/:code",
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/organizations/origin/:origin/externalId/:externalId/attributes/:code",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/organizations/origin/:origin/externalId/:externalId/eservices",
      async (_req, res) => res.status(501).send()
    );

  return apiGatewayRouter;
};

export default apiGatewayRouter;
