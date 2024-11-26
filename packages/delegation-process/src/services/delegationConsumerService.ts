import { delegationApi } from "pagopa-interop-api-clients";
import {
  AppContext,
  DB,
  eventRepository,
  FileManager,
  PDFGenerator,
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
import { config } from "../config/config.js";
import {
  toCreateEventConsumerDelegationApproved,
  toCreateEventConsumerDelegationSubmitted,
} from "../model/domain/toEvent.js";
import { contractBuilder } from "./delegationContractBuilder.js";
import {
  retrieveDelegationById,
  retrieveEserviceById,
  retrieveTenantById,
} from "./delegationService.js";
import { ReadModelService } from "./readModelService.js";
import {
  assertDelegationNotExists,
  assertDelegatorIsNotDelegate,
  assertIsDelegate,
  assertIsState,
  assertTenantAllowedToReceiveDelegation,
  assertDelegatorAndDelegateIPA,
  assertDelegationKindIs,
} from "./validators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationConsumerServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager
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
    async approveConsumerDelegation(
      delegationId: DelegationId,
      { logger, correlationId, authData }: WithLogger<AppContext>
    ): Promise<void> {
      const delegateId = unsafeBrandId<TenantId>(authData.organizationId);

      logger.info(
        `Approving delegation ${delegationId} by delegate ${delegateId}`
      );

      const { data: delegation, metadata } = await retrieveDelegationById(
        readModelService,
        delegationId
      );

      assertDelegationKindIs(delegationKind.delegatedConsumer, delegation);
      assertIsDelegate(delegation, delegateId);
      assertIsState(delegationState.waitingForApproval, delegation);

      const [delegator, delegate, eservice] = await Promise.all([
        retrieveTenantById(readModelService, delegation.delegatorId),
        retrieveTenantById(readModelService, delegation.delegateId),
        retrieveEserviceById(readModelService, delegation.eserviceId),
      ]);

      const now = new Date();
      const approvedDelegationWithoutContract: Delegation = {
        ...delegation,
        state: delegationState.active,
        approvedAt: now,
        stamps: {
          ...delegation.stamps,
          activation: {
            who: authData.userId,
            when: now,
          },
        },
      };

      const activationContract = await contractBuilder.createActivationContract(
        {
          delegation: approvedDelegationWithoutContract,
          delegator,
          delegate,
          eservice,
          pdfGenerator,
          fileManager,
          config,
          logger,
        }
      );

      const approvedDelegation = {
        ...approvedDelegationWithoutContract,
        activationContract,
      };

      await repository.createEvent(
        toCreateEventConsumerDelegationApproved(
          {
            data: approvedDelegation,
            metadata,
          },
          correlationId
        )
      );
    },
  };
}

export type DelegationConsumerService = ReturnType<
  typeof delegationConsumerServiceBuilder
>;
