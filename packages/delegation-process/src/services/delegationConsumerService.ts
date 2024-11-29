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
  DelegationId,
  delegationKind,
  delegationState,
  EServiceId,
  generateId,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { toCreateEventConsumerDelegationSubmitted } from "../model/domain/toEvent.js";
import {
  retrieveTenantById,
  retrieveEserviceById,
} from "./delegationService.js";
import {
  assertDelegatorIsNotDelegate,
  assertDelegationNotExists,
  assertTenantAllowedToReceiveDelegation,
  assertDelegatorAndDelegateIPA,
} from "./validators.js";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationConsumerServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService
) {
  const repository = eventRepository(dbInstance, delegationEventToBinaryDataV2);
  return {
    async createConsumerDelegation(
      delegationSeed: delegationApi.DelegationSeed,
      { authData, logger, correlationId }: WithLogger<AppContext>
    ): Promise<Delegation> {
      const delegatorId = unsafeBrandId<TenantId>(authData.organizationId);
      const delegateId = unsafeBrandId<TenantId>(delegationSeed.delegateId);
      const eserviceId = unsafeBrandId<EServiceId>(delegationSeed.eserviceId);

      logger.info(
        `Creating a delegation for tenant ${delegationSeed.delegateId} by consumer ${delegatorId}`
      );

      assertDelegatorIsNotDelegate(delegatorId, delegateId);

      const delegator = await retrieveTenantById(readModelService, delegatorId);
      const delegate = await retrieveTenantById(readModelService, delegateId);

      assertTenantAllowedToReceiveDelegation(
        delegate,
        delegationKind.delegatedConsumer
      );
      await assertDelegatorAndDelegateIPA(delegator, delegate);

      await retrieveEserviceById(readModelService, eserviceId);
      await assertDelegationNotExists(
        delegator,
        eserviceId,
        delegationKind.delegatedConsumer,
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
        kind: delegationKind.delegatedConsumer,
        stamps: {
          submission: {
            who: authData.userId,
            when: creationDate,
          },
        },
      };

      await repository.createEvent(
        toCreateEventConsumerDelegationSubmitted(delegation, correlationId)
      );

      return delegation;
    },
  };
}

export type DelegationConsumerService = ReturnType<
  typeof delegationConsumerServiceBuilder
>;
