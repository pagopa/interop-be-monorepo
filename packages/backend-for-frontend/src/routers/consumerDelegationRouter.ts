import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import {
  ExpressContext,
  FileManager,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { fromBffAppContext } from "../utilities/context.js";
import { emptyErrorMapper, makeApiProblem } from "../model/errors.js";
import { delegationServiceBuilder } from "../services/delegationService.js";

const consumerDelegationRouter = (
  ctx: ZodiosContext,
  {
    delegationProcessClient,
    tenantProcessClient,
    catalogProcessClient,
  }: PagoPAInteropBeClients,
  fileManager: FileManager
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const consumerDelegationRouter = ctx.router(
    bffApi.consumerDelegationsApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );
  const delegationService = delegationServiceBuilder(
    delegationProcessClient,
    tenantProcessClient,
    catalogProcessClient,
    fileManager
  );

  consumerDelegationRouter
    .post("/consumer/delegations", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const delegationResource =
          await delegationService.createConsumerDelegation(req.body, ctx);

        return res
          .status(200)
          .send(bffApi.CreatedResource.parse(delegationResource));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error creating delegation`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/consumer/delegations/:delegationId/approve", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await delegationService.delegateApproveConsumerDelegation(
          unsafeBrandId(req.params.delegationId),
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error approving delegation with id ${req.params.delegationId}`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/consumer/delegations/:delegationId/reject", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await delegationService.delegateRejectConsumerDelegation(
          unsafeBrandId(req.params.delegationId),
          req.body,
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error rejecting delegation with id ${req.params.delegationId}`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/consumer/delegations/:delegationId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await delegationService.delegatorRevokeConsumerDelegation(
          unsafeBrandId(req.params.delegationId),
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error revoking delegation with id ${req.params.delegationId}`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    });

  return consumerDelegationRouter;
};

export default consumerDelegationRouter;