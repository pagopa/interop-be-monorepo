import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { delegationApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  ReadModelRepository,
  ZodiosContext,
  fromAppContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { TenantId, unsafeBrandId } from "pagopa-interop-models";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { config } from "../config/config.js";
import {
  apiDelegationKindToDelegationKind,
  apiDelegationStateToDelegationState,
  delegationToApiDelegation,
} from "../model/domain/apiConverter.js";
import { makeApiProblem } from "../model/domain/errors.js";
import { getDelegationErrorMapper } from "../utilites/errorMappers.js";
import { delegationServiceBuilder } from "../services/delegationService.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);

const delegationRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const delegationRouter = ctx.router(delegationApi.delegationApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const delegationService = delegationServiceBuilder(readModelService);

  delegationRouter
    .get("/delegations", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      const {
        offset,
        limit,
        delegateIds,
        delegatorIds,
        delegationStates,
        kind,
      } = req.query;

      try {
        const delegations = await delegationService.getDelegations(
          delegateIds.map(unsafeBrandId<TenantId>),
          delegatorIds.map(unsafeBrandId<TenantId>),
          delegationStates.map(apiDelegationStateToDelegationState),
          kind && apiDelegationKindToDelegationKind(kind),
          offset,
          limit
        );

        return res.status(200).send(
          delegationApi.Delegations.parse({
            results: delegations.map((delegation) =>
              delegationToApiDelegation(delegation)
            ),
            totalCount: delegations.length,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getDelegationErrorMapper,
          ctx.logger,
          ctx.correlationId
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/delegations/:delegationId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      const { delegationId } = req.params;

      try {
        const delegation = await delegationService.getDelegationById(
          unsafeBrandId(delegationId)
        );

        return res
          .status(200)
          .send(
            delegationApi.Delegation.parse(
              delegationToApiDelegation(delegation)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getDelegationErrorMapper,
          ctx.logger,
          ctx.correlationId
        );

        return res.status(errorRes.status).send(errorRes);
      }
    });

  return delegationRouter;
};

export default delegationRouter;
