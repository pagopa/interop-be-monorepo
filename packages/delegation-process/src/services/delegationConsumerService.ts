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
  toCreateEventConsumerDelegationRevoked,
  toCreateEventConsumerDelegationSubmitted,
} from "../model/domain/toEvent.js";
import { contractBuilder } from "./delegationContractBuilder.js";
import {
  retrieveDelegation,
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

      const { data: delegation, metadata } = await retrieveDelegation(
        readModelService,
        delegationId,
        delegationKind.delegatedConsumer
      );

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

    async revokeConsumerDelegation(
      delegationId: DelegationId,
      { authData, logger, correlationId }: WithLogger<AppContext>
    ): Promise<Delegation> {
      const delegatorId = unsafeBrandId<TenantId>(authData.organizationId);
      logger.info(
        `Revoking delegation ${delegationId} by consumer ${delegatorId}`
      );

      const { data: delegation, metadata } = await retrieveDelegationById(
        readModelService,
        delegationId
      );

      // TODO Add validations after https://github.com/pagopa/interop-be-monorepo/pull/1217 is merged

      const [delegator, delegate, eservice] = await Promise.all([
        retrieveTenantById(readModelService, delegation.delegatorId),
        retrieveTenantById(readModelService, delegation.delegateId),
        retrieveEserviceById(readModelService, delegation.eserviceId),
      ]);

      const now = new Date();
      const revokedDelegationWithoutContract = {
        ...delegation,
        state: delegationState.revoked,
        revokedAt: now,
        stamps: {
          ...delegation.stamps,
          revocation: {
            who: delegatorId,
            when: now,
          },
        },
      };

      const revocationContract = await contractBuilder.createRevocationContract(
        {
          delegation: revokedDelegationWithoutContract,
          delegator,
          delegate,
          eservice,
          pdfGenerator,
          fileManager,
          config,
          logger,
        }
      );

      const revokedDelegation = {
        ...revokedDelegationWithoutContract,
        revocationContract,
      };

      await repository.createEvent(
        toCreateEventConsumerDelegationRevoked(
          {
            data: revokedDelegation,
            metadata,
          },
          correlationId
        )
      );

      return revokedDelegation;
    },
  };
}

export type DelegationConsumerService = ReturnType<
  typeof delegationConsumerServiceBuilder
>;
