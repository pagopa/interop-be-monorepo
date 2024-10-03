import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
// import { delegationServiceBuilder } from "../services/delegationService.js";

const delegationRouter = (
  ctx: ZodiosContext,
  _processClients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const delegationRouter = ctx.router(bffApi.delegationApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  // const delegationService = delegationServiceBuilder(processClients);

  delegationRouter
    .get("/leadOrganization/delegations", async (_req, res) =>
      res.status(501).send()
    )
    .get("/leadOrganization/delegations/:delegationId", async (_req, res) =>
      res.status(501).send()
    )
    .post("/leadOrganization/delegations", async (_req, res) =>
      res.status(501).send()
    )
    .post(
      "/leadOrganization/delegations/:delegationId/approve",
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/leadOrganization/delegations/:delegationId/reject",
      async (_req, res) => res.status(501).send()
    )
    .delete("/leadOrganization/delegations/:delegationId", async (_req, res) =>
      res.status(501).send()
    );

  return delegationRouter;
};

export default delegationRouter;
