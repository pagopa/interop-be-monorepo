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
import { DelegationService } from "../services/delegationService.js";
import { makeApiProblem } from "../model/errors.js";
import {
  getDelegationByIdErrorMapper,
  getDelegationsErrorMapper,
} from "../utilities/errorMappers.js";

const delegationRouter = (
  ctx: ZodiosContext,
  delegationService: DelegationService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const delegationRouter = ctx.router(bffApi.delegationsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  delegationRouter
    .get("/delegations", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const {
          limit,
          offset,
          states,
          kind,
          delegateIds,
          delegatorIds,
          eserviceIds,
        } = req.query;

        const delegations = await delegationService.getDelegations(
          {
            limit,
            offset,
            states,
            delegatorIds,
            delegateIds,
            eserviceIds,
            kind,
          },
          ctx
        );

        return res
          .status(200)
          .send(bffApi.CompactDelegations.parse(delegations));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getDelegationsErrorMapper,
          ctx,
          `Error retrieving delegations`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/delegations/:delegationId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const delegation = await delegationService.getDelegation(
          unsafeBrandId(req.params.delegationId),
          ctx
        );

        return res.status(200).send(bffApi.Delegation.parse(delegation));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getDelegationByIdErrorMapper,
          ctx,
          `Error retrieving delegation by id ${req.params.delegationId}`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/delegations/:delegationId/contracts/:contractId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { delegationId, contractId } = req.params;

        try {
          const result = await delegationService.getDelegationContract(
            unsafeBrandId(delegationId),
            unsafeBrandId(contractId),
            ctx
          );

          return res.status(200).send(result);
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error retrieving contract ${req.params.contractId} of delegation ${req.params.delegationId}`
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/delegations/:delegationId/signedContract/:contractId",
      async (req, res) => {
        const ctx = fromBffAppContext(req.ctx, req.headers);
        const { delegationId, contractId } = req.params;

        try {
          const result = await delegationService.getDelegationSignedContract(
            unsafeBrandId(delegationId),
            unsafeBrandId(contractId),
            ctx
          );

          return res.status(200).send(result);
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error retrieving contract of delegation ${req.params.delegationId}`
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    );
  return delegationRouter;
};

export default delegationRouter;
