import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";

const producerDelegationRouter = (
  ctx: ZodiosContext,
  _processClients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const producerDelegationRouter = ctx.router(
    bffApi.producerDelegationsApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );

  producerDelegationRouter
    .post("/producer/delegations", async (_req, res) => {
      res.status(501).send();
    })
    .post("/producer/delegations/:delegationId/approve", async (_req, res) =>
      res.status(501).send()
    )
    .post("/producer/delegations/:delegationId/reject", async (_req, res) =>
      res.status(501).send()
    )
    .delete("/producer/delegations/:delegationId", async (_req, res) =>
      res.status(501).send()
    );

  return producerDelegationRouter;
};

export default producerDelegationRouter;
