import { delegationApi } from "pagopa-interop-api-clients";
import {
  AppContext,
  DB,
  eventRepository,
  WithLogger,
} from "pagopa-interop-commons";
import {
  Delegation,
  delegationEventToBinaryDataV2,
  delegationKind,
  EServiceId,
  generateId,
  Tenant,
  unsafeBrandId,
} from "pagopa-interop-models";
import { DelegationId, TenantId, delegationState } from "pagopa-interop-models";
import { tenantNotFound } from "../model/domain/errors.js";
import {
  toCreateEventApproveDelegation,
  toCreateEventProducerDelegation,
  toCreateEventRejectDelegation,
} from "../model/domain/toEvent.js";
import { ReadModelService } from "./readModelService.js";
import {
  assertDelegationExists,
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
    async approveProducerDelegation(
      delegateId: TenantId,
      delegationId: DelegationId,
      correlationId: string
    ): Promise<void> {
      const delegationWithMeta = await readModelService.getDelegationById(
        delegationId
      );

      const { data: delegation, metadata } = assertDelegationExists(
        delegationId,
        delegationWithMeta
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
      const delegationWithMeta = await readModelService.getDelegationById(
        delegationId
      );

      const { data: delegation, metadata } = assertDelegationExists(
        delegationId,
        delegationWithMeta
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
