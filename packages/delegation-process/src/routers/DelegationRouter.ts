import { ZodiosRouter } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import { delegationApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  ZodiosContext,
  authRole,
  fromAppContext,
  setMetadataVersionHeader,
  validateAuthorization,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import {
  DelegationContractDocument,
  EServiceId,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
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
  createProducerDelegationErrorMapper,
  createConsumerDelegationErrorMapper,
  approveDelegationErrorMapper,
  rejectDelegationErrorMapper,
  revokeDelegationErrorMapper,
  getConsumerDelegatorsErrorMapper,
  getConsumerEservicesErrorMapper,
  getConsumerDelegatorsWithAgreementsErrorMapper,
  generateDelegationContractErrorMapper,
} from "../utilities/errorMappers.js";
import { DelegationService } from "../services/delegationService.js";

const {
  ADMIN_ROLE,
  API_ROLE,
  SECURITY_ROLE,
  M2M_ROLE,
  SUPPORT_ROLE,
  M2M_ADMIN_ROLE,
  INTERNAL_ROLE,
} = authRole;

const delegationRouter = (
  ctx: ZodiosContext,
  delegationService: DelegationService
): Array<ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext>> => {
  const delegationRouter = ctx.router(delegationApi.delegationApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  delegationRouter
    .get("/delegations", async (req, res) => {
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
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
          SUPPORT_ROLE,
        ]);

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
          ctx
        );

        return res.status(200).send(
          delegationApi.Delegations.parse({
            results: delegations.results.map(delegationToApiDelegation),
            totalCount: delegations.totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(error, getDelegationsErrorMapper, ctx);

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/delegations/:delegationId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      const { delegationId } = req.params;

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
          SUPPORT_ROLE,
        ]);

        const { data, metadata } = await delegationService.getDelegationById(
          unsafeBrandId(delegationId),
          ctx
        );

        setMetadataVersionHeader(res, metadata);
        return res
          .status(200)
          .send(
            delegationApi.Delegation.parse(delegationToApiDelegation(data))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getDelegationByIdErrorMapper,
          ctx
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/delegations/:delegationId/contracts/:contractId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        const { delegationId, contractId } = req.params;

        try {
          validateAuthorization(ctx, [
            ADMIN_ROLE,
            API_ROLE,
            SECURITY_ROLE,
            M2M_ROLE,
            SUPPORT_ROLE,
          ]);

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
            ctx,
            `Error retrieving contract ${req.params.contractId} of delegation ${req.params.delegationId}`
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/internal/delegations/:delegationId/contract", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [INTERNAL_ROLE]);
        const { delegationId } = req.params;
        const delegationContract = DelegationContractDocument.parse(req.body);

        const { metadata } =
          await delegationService.internalAddDelegationContract(
            unsafeBrandId(delegationId),
            delegationContract,
            ctx
          );

        setMetadataVersionHeader(res, metadata);
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          generateDelegationContractErrorMapper,
          ctx
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post(
      "/internal/delegations/:delegationId/signedContract",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [INTERNAL_ROLE]);

          const { delegationId } = req.params;
          const delegationContract = DelegationContractDocument.parse(req.body);

          const { metadata } =
            await delegationService.internalAddDelegationSignedContract(
              unsafeBrandId(delegationId),
              delegationContract,
              ctx
            );
          setMetadataVersionHeader(res, metadata);

          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            generateDelegationContractErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  const delegationProducerRouter = ctx.router(delegationApi.producerApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  delegationProducerRouter
    .post("/producer/delegations", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { data, metadata } =
          await delegationService.createProducerDelegation(
            {
              delegateId: unsafeBrandId<TenantId>(req.body.delegateId),
              eserviceId: unsafeBrandId<EServiceId>(req.body.eserviceId),
            },
            ctx
          );

        setMetadataVersionHeader(res, metadata);
        return res
          .status(200)
          .json(
            delegationApi.Delegation.parse(delegationToApiDelegation(data))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createProducerDelegationErrorMapper,
          ctx
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/producer/delegations/:delegationId/approve", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      const { delegationId } = req.params;

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { data, metadata } =
          await delegationService.approveProducerDelegation(
            unsafeBrandId(delegationId),
            ctx
          );

        setMetadataVersionHeader(res, metadata);
        return res
          .status(200)
          .send(
            delegationApi.Delegation.parse(delegationToApiDelegation(data))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          approveDelegationErrorMapper,
          ctx
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/producer/delegations/:delegationId/reject", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      const { delegationId } = req.params;
      const { rejectionReason } = req.body;

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { data, metadata } =
          await delegationService.rejectProducerDelegation(
            unsafeBrandId(delegationId),
            rejectionReason,
            ctx
          );

        setMetadataVersionHeader(res, metadata);
        return res
          .status(200)
          .send(
            delegationApi.Delegation.parse(delegationToApiDelegation(data))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          rejectDelegationErrorMapper,
          ctx
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/producer/delegations/:delegationId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const { delegationId } = req.params;
        await delegationService.revokeProducerDelegation(
          unsafeBrandId(delegationId),
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          revokeDelegationErrorMapper,
          ctx
        );

        return res.status(errorRes.status).send(errorRes);
      }
    });

  const delegationConsumerRouter = ctx.router(delegationApi.consumerApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  delegationConsumerRouter
    .post("/consumer/delegations", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { data, metadata } =
          await delegationService.createConsumerDelegation(
            {
              delegateId: unsafeBrandId<TenantId>(req.body.delegateId),
              eserviceId: unsafeBrandId<EServiceId>(req.body.eserviceId),
            },
            ctx
          );

        setMetadataVersionHeader(res, metadata);
        return res
          .status(200)
          .json(
            delegationApi.Delegation.parse(delegationToApiDelegation(data))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createConsumerDelegationErrorMapper,
          ctx
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/consumer/delegations/:delegationId/approve", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { data, metadata } =
          await delegationService.approveConsumerDelegation(
            unsafeBrandId(req.params.delegationId),
            ctx
          );

        setMetadataVersionHeader(res, metadata);
        return res
          .status(200)
          .json(
            delegationApi.Delegation.parse(delegationToApiDelegation(data))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          approveDelegationErrorMapper,
          ctx
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/consumer/delegations/:delegationId/reject", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      const { rejectionReason } = req.body;

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { data, metadata } =
          await delegationService.rejectConsumerDelegation(
            unsafeBrandId(req.params.delegationId),
            rejectionReason,
            ctx
          );

        setMetadataVersionHeader(res, metadata);
        return res
          .status(200)
          .send(
            delegationApi.Delegation.parse(delegationToApiDelegation(data))
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          rejectDelegationErrorMapper,
          ctx
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/consumer/delegations/:delegationId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const { delegationId } = req.params;
        await delegationService.revokeConsumerDelegation(
          unsafeBrandId(delegationId),
          ctx
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          revokeDelegationErrorMapper,
          ctx
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/consumer/delegators", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      const { delegatorName, eserviceIds, limit, offset } = req.query;

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          SUPPORT_ROLE,
        ]);

        const delegators = await delegationService.getConsumerDelegators(
          {
            delegatorName,
            eserviceIds: eserviceIds.map(unsafeBrandId<EServiceId>),
            limit,
            offset,
          },
          ctx
        );

        return res
          .status(200)
          .send(delegationApi.CompactTenants.parse(delegators));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getConsumerDelegatorsErrorMapper,
          ctx
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/consumer/delegatorsWithAgreements", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      const { delegatorName, limit, offset } = req.query;

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          SUPPORT_ROLE,
        ]);

        const delegators =
          await delegationService.getConsumerDelegatorsWithAgreements(
            {
              delegatorName,
              limit,
              offset,
            },
            ctx
          );

        return res
          .status(200)
          .send(delegationApi.CompactTenants.parse(delegators));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getConsumerDelegatorsWithAgreementsErrorMapper,
          ctx
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/consumer/eservices", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      const { delegatorId, eserviceName, limit, offset } = req.query;

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          API_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          SUPPORT_ROLE,
        ]);

        const eservices = await delegationService.getConsumerEservices(
          {
            delegatorId: unsafeBrandId(delegatorId),
            eserviceName,
            limit,
            offset,
          },
          ctx
        );

        return res
          .status(200)
          .send(delegationApi.CompactEServices.parse(eservices));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getConsumerEservicesErrorMapper,
          ctx
        );

        return res.status(errorRes.status).send(errorRes);
      }
    });

  return [delegationRouter, delegationProducerRouter, delegationConsumerRouter];
};

export default delegationRouter;
