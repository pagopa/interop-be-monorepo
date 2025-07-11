import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { emptyErrorMapper, unsafeBrandId } from "pagopa-interop-models";
import { fromBffAppContext } from "../utilities/context.js";
import { makeApiProblem } from "../model/errors.js";
import { DelegationService } from "../services/delegationService.js";

const producerDelegationRouter = (
  ctx: ZodiosContext,
  delegationService: DelegationService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const producerDelegationRouter = ctx.router(
    bffApi.producerDelegationsApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );

  producerDelegationRouter
    .post("/producers/delegations", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const delegationResource =
          await delegationService.createProducerDelegation(req.body, ctx);

        return res
          .status(200)
          .send(bffApi.CreatedResource.parse(delegationResource));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating delegation`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/producers/delegations/:delegationId/approve", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await delegationService.approveProducerDelegation(
          unsafeBrandId(req.params.delegationId),
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error approving delegation with id ${req.params.delegationId}`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/producers/delegations/:delegationId/reject", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        await delegationService.rejectProducerDelegation(
          unsafeBrandId(req.params.delegationId),
          req.body,
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error rejecting delegation with id ${req.params.delegationId}`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/producers/delegations/:delegationId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        await delegationService.revokeProducerDelegation(
          unsafeBrandId(req.params.delegationId),
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error revoking delegation with id ${req.params.delegationId}`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    });

  return producerDelegationRouter;
};

export default producerDelegationRouter;
