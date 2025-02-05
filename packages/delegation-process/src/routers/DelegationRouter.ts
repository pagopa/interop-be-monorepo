import { ZodiosRouter } from "@zodios/express";
import { delegationApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  ReadModelRepository,
  ZodiosContext,
  authorizationMiddleware,
  fromAppContext,
  userRoles,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { EServiceId, TenantId, unsafeBrandId } from "pagopa-interop-models";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { config } from "../config/config.js";
import {
  apiDelegationKindToDelegationKind,
  apiDelegationStateToDelegationState,
  delegationContractToApiDelegationContract,
  delegationToApiDelegation,
} from "../model/domain/apiConverter.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  getDelegationsErrorMapper,
  getDelegationByIdErrorMapper,
  getDelegationContractErrorMapper,
} from "../utilities/errorMappers.js";
import { delegationServiceBuilder } from "../services/delegationService.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);

const delegationService = delegationServiceBuilder(readModelService);

const { ADMIN_ROLE, API_ROLE, SECURITY_ROLE, M2M_ROLE, SUPPORT_ROLE } =
  userRoles;

const delegationRouter = (
  ctx: ZodiosContext
): ZodiosRouter<typeof delegationApi.delegationApi.api, ExpressContext> => {
  const delegationRouter = ctx.router(delegationApi.delegationApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  delegationRouter
    .get(
      "/delegations",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        const {
          offset,
          limit,
          delegateIds,
          delegatorIds,
          eserviceIds,
          delegationStates,
          kind,
        } = req.query;

        try {
          const delegations = await delegationService.getDelegations(
            {
              delegateIds: delegateIds.map(unsafeBrandId<TenantId>),
              delegatorIds: delegatorIds.map(unsafeBrandId<TenantId>),
              delegationStates: delegationStates.map(
                apiDelegationStateToDelegationState
              ),
              eserviceIds: eserviceIds.map(unsafeBrandId<EServiceId>),
              kind: kind && apiDelegationKindToDelegationKind(kind),
              offset,
              limit,
            },
            ctx.logger
          );

          return res.status(200).send(
            delegationApi.Delegations.parse({
              results: delegations.results.map(delegationToApiDelegation),
              totalCount: delegations.totalCount,
            })
          );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getDelegationsErrorMapper,
            ctx.logger,
            ctx.correlationId
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/delegations/:delegationId",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        const { delegationId } = req.params;

        try {
          const delegation = await delegationService.getDelegationById(
            unsafeBrandId(delegationId),
            ctx.logger
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
            getDelegationByIdErrorMapper,
            ctx.logger,
            ctx.correlationId
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .get(
      "/delegations/:delegationId/contracts/:contractId",
      authorizationMiddleware([
        ADMIN_ROLE,
        API_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        const { delegationId, contractId } = req.params;

        try {
          const contract = await delegationService.getDelegationContract(
            unsafeBrandId(delegationId),
            unsafeBrandId(contractId),
            ctx
          );

          return res
            .status(200)
            .send(
              delegationApi.DelegationContractDocument.parse(
                delegationContractToApiDelegationContract(contract)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getDelegationContractErrorMapper,
            ctx.logger,
            ctx.correlationId,
            `Error retrieving contract ${req.params.contractId} of delegation ${req.params.delegationId}`
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  return delegationRouter;
};

export default delegationRouter;
