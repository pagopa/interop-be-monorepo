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
import { delegationNotFound } from "../model/domain/errors.js";
import { toCreateEventProducerDelegation } from "../model/domain/toEvent.js";
import { ReadModelService } from "./readModelService.js";
import {
  assertDelegationNotExists,
  assertEserviceExists,
  assertTenantExists,
} from "./validators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationProducerServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService
) {
  const repository = eventRepository(dbInstance, delegationEventToBinaryDataV2);
  return {
    async getDelegationById(delegationId: DelegationId): Promise<Delegation> {
      const delegation = await readModelService.getDelegationById(delegationId);

      if (!delegation) {
        throw delegationNotFound(delegationId);
      }

      return delegation;
    },
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

      await assertEserviceExists(eserviceId, readModelService);
      await assertTenantExists(delegateId, readModelService);
      await assertDelegationNotExists(
        delegatorId,
        delegateId,
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
  };
}

export type DelegationProducerService = ReturnType<
  typeof delegationProducerServiceBuilder
>;
