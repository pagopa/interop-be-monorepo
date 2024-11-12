import { delegationApi } from "pagopa-interop-api-clients";
import {
  AppContext,
  DB,
  eventRepository,
  FileManager,
  Logger,
  PDFGenerator,
  WithLogger,
} from "pagopa-interop-commons";
import {
  CorrelationId,
  Delegation,
  DelegationId,
  delegationEventToBinaryDataV2,
  delegationKind,
  delegationState,
  EServiceId,
  generateId,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  toCreateEventProducerDelegationSubmitted,
  toCreateEventProducerDelegationRevoked,
  toCreateEventProducerDelegationApproved,
  toCreateEventProducerDelegationRejected,
} from "../model/domain/toEvent.js";
import { config } from "../config/config.js";
import { ReadModelService } from "./readModelService.js";
import {
  assertDelegationIsRevokable,
  assertDelegationNotExists,
  assertDelegatorIsIPA,
  assertDelegatorIsNotDelegate,
  assertTenantAllowedToReceiveProducerDelegation,
  assertIsDelegate,
  assertIsState,
  assertDelegatorIsProducer,
} from "./validators.js";
import { contractBuilder } from "./delegationContractBuilder.js";
import {
  retrieveDelegationById,
  retrieveEserviceById,
  retrieveTenantById,
} from "./delegationService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationProducerServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager
) {
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

      const delegator = await retrieveTenantById(readModelService, delegatorId);
      const delegate = await retrieveTenantById(readModelService, delegateId);

      assertTenantAllowedToReceiveProducerDelegation(delegate);
      await assertDelegatorIsIPA(delegator);

      const eservice = await retrieveEserviceById(readModelService, eserviceId);
      assertDelegatorIsProducer(delegatorId, eservice);
      await assertDelegationNotExists(
        delegator,
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
        toCreateEventProducerDelegationSubmitted(delegation, correlationId)
      );

      return delegation;
    },
    async revokeProducerDelegation(
      delegationId: DelegationId,
      { authData, logger, correlationId }: WithLogger<AppContext>
    ): Promise<Delegation> {
      const delegatorId = unsafeBrandId<TenantId>(authData.organizationId);
      logger.info(
        `Revoking delegation:${delegationId} by producer:${delegatorId}`
      );

      const currentDelegation = await retrieveDelegationById(
        readModelService,
        delegationId
      );
      assertDelegationIsRevokable(currentDelegation.data, delegatorId);

      const [delegator, delegate, eservice] = await Promise.all([
        retrieveTenantById(
          readModelService,
          currentDelegation.data.delegatorId
        ),
        retrieveTenantById(readModelService, currentDelegation.data.delegateId),
        retrieveEserviceById(
          readModelService,
          currentDelegation.data.eserviceId
        ),
      ]);

      const revocationContract = await contractBuilder.createRevocationContract(
        {
          delegation: currentDelegation.data,
          delegator,
          delegate,
          eservice,
          pdfGenerator,
          fileManager,
          config,
          logger,
        }
      );

      const now = new Date();
      const revokedDelegation = {
        ...currentDelegation.data,
        state: delegationState.revoked,
        revokedAt: now,
        revocationContract,
        stamps: {
          ...currentDelegation.data.stamps,
          revocation: {
            who: delegatorId,
            when: now,
          },
        },
      };

      await repository.createEvent(
        toCreateEventProducerDelegationRevoked(
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
      correlationId: CorrelationId,
      logger: Logger
    ): Promise<void> {
      const { data: delegation, metadata } = await retrieveDelegationById(
        readModelService,
        delegationId
      );

      const [delegator, delegate, eservice] = await Promise.all([
        retrieveTenantById(readModelService, delegation.delegatorId),
        retrieveTenantById(readModelService, delegation.delegateId),
        retrieveEserviceById(readModelService, delegation.eserviceId),
      ]);

      assertIsDelegate(delegation, delegateId);
      assertIsState(delegationState.waitingForApproval, delegation);

      const activationContract = await contractBuilder.createActivationContract(
        {
          delegation,
          delegator,
          delegate,
          eservice,
          pdfGenerator,
          fileManager,
          config,
          logger,
        }
      );

      const now = new Date();

      await repository.createEvent(
        toCreateEventProducerDelegationApproved(
          {
            data: {
              ...delegation,
              state: delegationState.active,
              approvedAt: now,
              activationContract,
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
      correlationId: CorrelationId,
      rejectionReason: string
    ): Promise<void> {
      const { data: delegation, metadata } = await retrieveDelegationById(
        readModelService,
        delegationId
      );

      assertIsDelegate(delegation, delegateId);
      assertIsState(delegationState.waitingForApproval, delegation);

      await repository.createEvent(
        toCreateEventProducerDelegationRejected(
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
