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
  delegationEventToBinaryDataV2,
  delegationKind,
  EService,
  EServiceId,
  generateId,
  Tenant,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import { DelegationId, TenantId, delegationState } from "pagopa-interop-models";
import {
  delegationNotFound,
  eserviceNotFound,
  tenantNotFound,
} from "../model/domain/errors.js";
import {
  toCreateEventApproveDelegation,
  toCreateEventProducerDelegation,
  toCreateEventRejectDelegation,
} from "../model/domain/toEvent.js";
import { config } from "../config/config.js";
import { ReadModelService } from "./readModelService.js";
import {
  assertDelegationNotExists,
  assertDelegatorIsIPA,
  assertDelegatorIsNotDelegate,
  assertEserviceExists,
  assertTenantAllowedToReceiveProducerDelegation,
  assertIsDelegate,
  assertIsState,
} from "./validators.js";
import { generatePdfDelegation } from "./pdfUtils.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function delegationProducerServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager
) {
  const getTenantById = async (tenantId: TenantId): Promise<Tenant> => {
    const tenant = await readModelService.getTenantById(tenantId);
    if (!tenant) {
      throw tenantNotFound(tenantId);
    }
    return tenant;
  };

  const getDelegationById = async (
    delegationId: DelegationId
  ): Promise<WithMetadata<Delegation>> => {
    const delegation = await readModelService.getDelegationById(delegationId);
    if (!delegation?.data) {
      throw delegationNotFound(delegationId);
    }
    return delegation;
  };

  const getEserviceById = async (id: EServiceId): Promise<EService> => {
    const eservice = await readModelService.getEServiceById(id);
    if (!eservice) {
      throw eserviceNotFound(id);
    }
    return eservice.data;
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
      correlationId: CorrelationId,
      logger: Logger
    ): Promise<void> {
      const { data: delegation, metadata } = await getDelegationById(
        delegationId
      );

      const delegator = await getTenantById(delegation.delegatorId);
      const delegate = await getTenantById(delegation.delegateId);
      const eservice = await getEserviceById(delegation.eserviceId);

      assertIsDelegate(delegation, delegateId);
      assertIsState(delegationState.waitingForApproval, delegation);

      const now = new Date();

      const pdfBuffer = await generatePdfDelegation(
        now,
        delegation,
        delegator,
        delegate,
        eservice,
        pdfGenerator
      );

      const documentPath = await fileManager.storeBytes(
        {
          bucket: config.s3Bucket,
          path: config.delegationDocumentPath,
          name: delegation.id,
          content: pdfBuffer,
        },
        logger
      );

      await repository.createEvent(
        toCreateEventApproveDelegation(
          {
            data: {
              ...delegation,
              state: delegationState.active,
              approvedAt: now,
              contract: {
                id: generateId(),
                name: "Delega.pdf",
                prettyName: "Delega.pdf",
                contentType: "application/pdf",
                path: documentPath,
                createdAt: now,
              },
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
      const { data: delegation, metadata } = await getDelegationById(
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
