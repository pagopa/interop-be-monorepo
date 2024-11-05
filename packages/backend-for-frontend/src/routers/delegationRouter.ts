import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { unsafeBrandId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { fromBffAppContext } from "../utilities/context.js";
import { delegationServiceBuilder } from "../services/delegationService.js";
import { makeApiProblem } from "../model/errors.js";
import {
  getDelegationByIdErrorMapper,
  getDelegationsErrorMapper,
} from "../utilities/errorMappers.js";

const delegationRouter = (
  ctx: ZodiosContext,
  {
    delegationProcessClient,
    tenantProcessClient,
    catalogProcessClient,
  }: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const delegationRouter = ctx.router(bffApi.delegationsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const delegationService = delegationServiceBuilder(
    delegationProcessClient,
    tenantProcessClient,
    catalogProcessClient
  );

  delegationRouter
    .get("/delegations", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);
      try {
        const { limit, offset, states, kind, delegatedIds, delegatorIds } =
          req.query;

        const delegations = await delegationService.getDelegations(
          {
            limit,
            offset,
            states,
            delegatorIds,
            delegatedIds,
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
          ctx.logger,
          ctx.correlationId,
          `Error retrieving delegations`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/delegations/:delegationId", async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const delegation = await delegationService.getDelegationById(
          unsafeBrandId(req.params.delegationId),
          ctx
        );

        return res.status(200).send(bffApi.Delegation.parse(delegation));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getDelegationByIdErrorMapper,
          ctx.logger,
          ctx.correlationId,
          `Error retrieving delegation by id ${req.params.delegationId}`
        );

        return res.status(errorRes.status).send(errorRes);
      }
    });
  return delegationRouter;
};

export default delegationRouter;