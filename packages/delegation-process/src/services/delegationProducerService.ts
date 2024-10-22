import { delegationApi } from "pagopa-interop-api-clients";
import {
  AppContext,
  DB,
  eventRepository,
  WithLogger,
} from "pagopa-interop-commons";
import {
  Delegation,
  DelegationId,
  delegationEventToBinaryDataV2,
  delegationKind,
  delegationState,
  EServiceId,
  generateId,
  Tenant,
  TenantId,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import { delegationNotFound, tenantNotFound } from "../model/domain/errors.js";
import {
  toCreateEventProducerDelegation,
  toRevokeEventProducerDelegation,
  toCreateEventApproveDelegation,
  toCreateEventRejectDelegation,
} from "../model/domain/toEvent.js";
import { ReadModelService } from "./readModelService.js";
import {
  assertDelegationIsRevokable,
  assertDelegationNotExists,
  assertDelegatorIsIPA,
  assertDelegatorIsNotDelegate,
  assertEserviceExists,
  assertTenantAllowedToReceiveProducerDelegation,
  assertIsDelegate,
  assertIsState,
} from "./validators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationProducerServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService
) {
  const getTenantById = async (tenantId: TenantId): Promise<Tenant> => {
    const tenant = await readModelService.getTenantById(tenantId);
    if (!tenant) {
      throw tenantNotFound(tenantId);
    }
    return tenant;
  };

  const retrieveDelegationById = async (
    delegationId: DelegationId
  ): Promise<WithMetadata<Delegation>> => {
    const delegation = await readModelService.getDelegationById(delegationId);
    if (!delegation?.data) {
      throw delegationNotFound(delegationId);
    }
    return delegation;
  };

  const repository = eventRepository(dbInstance, delegationEventToBinaryDataV2);
  return {
    async createProducerDelegation(
      delegationSeed: delegationApi.DelegationSeed,
      { authData, logger, correlationId }: WithLogger<AppContext>
    ): Promise<Delegation> {
      const delegatorId = unsafeBrandId<TenantId>(authData.organizationId);
      const delegateId = unsafeBrandId<TenantId>(delegationSeed.delegateId);
      const eserviceId = unsafeBrandId<EServiceId>(delegationSeed.eserviceId);

      logger.info(
        `Creating a delegation for tenant:${delegationSeed.delegateId} by producer:${delegatorId}`
      );

      assertDelegatorIsNotDelegate(delegatorId, delegateId);

      const delegator = await getTenantById(delegatorId);
      const delegate = await getTenantById(delegateId);

      assertTenantAllowedToReceiveProducerDelegation(delegate);
      await assertDelegatorIsIPA(delegator);
      await assertEserviceExists(eserviceId, readModelService);
      await assertDelegationNotExists(
        delegator,
        delegate,
        eserviceId,
        delegationKind.delegatedProducer,
        readModelService
      );

      const creationDate = new Date();
      const delegation = {
        id: generateId<DelegationId>(),
        delegatorId,
        delegateId,
        eserviceId,
        createdAt: creationDate,
        submittedAt: creationDate,
        state: delegationState.waitingForApproval,
        kind: delegationKind.delegatedProducer,
        stamps: {
          submission: {
            who: delegatorId,
            when: creationDate,
          },
        },
      };

      await repository.createEvent(
        toCreateEventProducerDelegation(delegation, correlationId)
      );

      return delegation;
    },
    async revokeDelegation(
      delegationId: DelegationId,
      { authData, logger, correlationId }: WithLogger<AppContext>
    ): Promise<Delegation> {
      const delegatorId = unsafeBrandId<TenantId>(authData.organizationId);
      logger.info(
        `Revoking delegation:${delegationId} by producer:${delegatorId}`
      );

      const currentDelegation = await retrieveDelegationById(delegationId);
      assertDelegationIsRevokable(currentDelegation.data, delegatorId);

      const now = new Date();
      const revokedDelegation = {
        ...currentDelegation.data,
        state: delegationState.revoked,
        revokedAt: now,
        stamps: {
          ...currentDelegation.data.stamps,
          revocation: {
            who: delegatorId,
            when: now,
          },
        },
      };

      await repository.createEvent(
        toRevokeEventProducerDelegation(
          revokedDelegation,
          currentDelegation.metadata.version,
          correlationId
        )
      );

      return revokedDelegation;
    },
    async approveProducerDelegation(
      delegateId: TenantId,
      delegationId: DelegationId,
      correlationId: string
    ): Promise<void> {
      const { data: delegation, metadata } = await retrieveDelegationById(
        delegationId
      );

      assertIsDelegate(delegation, delegateId);
      assertIsState(delegationState.waitingForApproval, delegation);

      const now = new Date();
      await repository.createEvent(
        toCreateEventApproveDelegation(
          {
            data: {
              ...delegation,
              state: delegationState.active,
              approvedAt: now,
              stamps: {
                ...delegation.stamps,
                activation: {
                  who: delegateId,
                  when: now,
                },
              },
            },
            metadata,
          },
          correlationId
        )
      );
    },
    async rejectProducerDelegation(
      delegateId: TenantId,
      delegationId: DelegationId,
      correlationId: string,
      rejectionReason: string
    ): Promise<void> {
      const { data: delegation, metadata } = await retrieveDelegationById(
        delegationId
      );

      assertIsDelegate(delegation, delegateId);
      assertIsState(delegationState.waitingForApproval, delegation);

      await repository.createEvent(
        toCreateEventRejectDelegation(
          {
            data: {
              ...delegation,
              state: delegationState.rejected,
              rejectedAt: new Date(),
              rejectionReason,
              stamps: {
                ...delegation.stamps,
                rejection: {
                  who: delegateId,
                  when: new Date(),
                },
              },
            },
            metadata,
          },
          correlationId
        )
      );
    },
  };
}

export type DelegationProducerService = ReturnType<
  typeof delegationProducerServiceBuilder
>;
