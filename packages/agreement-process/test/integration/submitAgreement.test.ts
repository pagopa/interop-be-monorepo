/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable functional/immutable-data */
import { fileURLToPath } from "url";
import path from "path";
import { fail } from "assert";
import {
  dateAtRomeZone,
  formatDateyyyyMMddHHmmss,
  genericLogger,
  timeAtRomeZone,
} from "pagopa-interop-commons";
import { addDays, subDays } from "date-fns";
import {
  addSomeRandomDelegations,
  decodeProtobufPayload,
  getMockAgreement,
  getMockAttribute,
  getMockCertifiedTenantAttribute,
  getMockContext,
  getMockDeclaredTenantAttribute,
  getMockDelegation,
  getMockDescriptor,
  getMockEService,
  getMockEServiceAttribute,
  getMockTenant,
  getMockVerifiedTenantAttribute,
  getMockAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementActivatedV2,
  AgreementId,
  AgreementSetMissingCertifiedAttributesByPlatformV2,
  AgreementSubmittedV2,
  AgreementV2,
  Attribute,
  DescriptorId,
  DescriptorState,
  EServiceId,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  Tenant,
  TenantAttribute,
  TenantId,
  UserId,
  agreementApprovalPolicy,
  agreementState,
  attributeKind,
  delegationKind,
  delegationState,
  descriptorState,
  fromAgreementV2,
  generateId,
  tenantMailKind,
  toAgreementStateV2,
} from "pagopa-interop-models";
import { describe, expect, it, vi } from "vitest";
import { agreementSubmissionConflictingStates } from "../../src/model/domain/agreement-validators.js";
import {
  agreementAlreadyExists,
  agreementNotFound,
  agreementNotInExpectedState,
  agreementSubmissionFailed,
  consumerWithNotValidEmail,
  descriptorNotInExpectedState,
  eServiceNotFound,
  notLatestEServiceDescriptor,
  tenantIsNotTheDelegateConsumer,
  tenantNotFound,
} from "../../src/model/domain/errors.js";
import { config } from "../../src/config/config.js";
import { AgreementContractPDFPayload } from "../../src/model/domain/models.js";
import {
  addDelegationsAndDelegates,
  addOneAgreement,
  addOneAttribute,
  addOneDelegation,
  addOneEService,
  addOneTenant,
  agreementService,
  fileManager,
  pdfGenerator,
  readLastAgreementEvent,
} from "../integrationUtils.js";
import {
  authDataAndDelegationsFromRequesterIs,
  getRandomPastStamp,
  requesterIs,
} from "../mockUtils.js";

const draftAgreementSubmissionSeed = {
  state: agreementState.draft,

  // The agreement is draft, so it doens't have a contract or attributes
  contract: undefined,
  certifiedAttributes: [],
  declaredAttributes: [],
  verifiedAttributes: [],

  // We set these flags because it's a possible case:
  // suspension flags are preserved in draft agreements that are created
  // during an upgrade operation (see agreementStatesFlows.test.ts)
  suspendedByConsumer: false,
  suspendedByProducer: false,
  stamps: {
    suspensionByConsumer: getRandomPastStamp(generateId<UserId>()),
    suspensionByProducer: getRandomPastStamp(generateId<UserId>()),
  },
  suspendedAt: new Date(),
};

// Seeds for suspended draft agreements with different suspension flag combinations
const suspendedByConsumerOnlySeed = {
  ...draftAgreementSubmissionSeed,
  suspendedByConsumer: true,
  suspendedByProducer: false,
};

const suspendedByProducerOnlySeed = {
  ...draftAgreementSubmissionSeed,
  suspendedByConsumer: false,
  suspendedByProducer: true,
};

const suspendedByBothSeed = {
  ...draftAgreementSubmissionSeed,
  suspendedByConsumer: true,
  suspendedByProducer: true,
};

describe("submit agreement", () => {
  async function addRelatedAgreements(agreement: Agreement): Promise<{
    archivableRelatedAgreement1: Agreement;
    archivableRelatedAgreement2: Agreement;
    nonArchivableRelatedAgreement: Agreement;
  }> {
    const archivableRelatedAgreement1: Agreement = {
      ...getMockAgreement(),
      consumerId: agreement.consumerId,
      eserviceId: agreement.eserviceId,
      state: agreementState.active,
    };

    const archivableRelatedAgreement2: Agreement = {
      ...getMockAgreement(),
      consumerId: agreement.consumerId,
      eserviceId: agreement.eserviceId,
      state: agreementState.suspended,
    };

    const nonArchivableRelatedAgreement: Agreement = {
      ...getMockAgreement(),
      consumerId: agreement.consumerId,
      eserviceId: agreement.eserviceId,
      state: randomArrayItem(
        Object.values(agreementState).filter(
          (state) =>
            !agreementSubmissionConflictingStates.includes(state) &&
            state !== agreementState.active &&
            state !== agreementState.suspended
        )
      ),
    };

    await addOneAgreement(archivableRelatedAgreement1);
    await addOneAgreement(archivableRelatedAgreement2);
    await addOneAgreement(nonArchivableRelatedAgreement);
    return {
      archivableRelatedAgreement1,
      archivableRelatedAgreement2,
      nonArchivableRelatedAgreement,
    };
  }

  async function testRelatedAgreementsArchiviation(relatedAgreements: {
    archivableRelatedAgreement1: Agreement;
    archivableRelatedAgreement2: Agreement;
    nonArchivableRelatedAgreement: Agreement;
  }): Promise<void> {
    // Verifying archiviation relating agreements
    const archiveEvent1 = await readLastAgreementEvent(
      relatedAgreements.archivableRelatedAgreement1.id
    );
    const archiveEvent2 = await readLastAgreementEvent(
      relatedAgreements.archivableRelatedAgreement2.id
    );
    const nonArchivedAgreementEvent = await readLastAgreementEvent(
      relatedAgreements.nonArchivableRelatedAgreement.id
    );

    expect(archiveEvent1).toMatchObject({
      type: "AgreementArchivedByUpgrade",
      event_version: 2,
      version: "1",
      stream_id: relatedAgreements.archivableRelatedAgreement1.id,
    });

    expect(archiveEvent2).toMatchObject({
      type: "AgreementArchivedByUpgrade",
      event_version: 2,
      version: "1",
      stream_id: relatedAgreements.archivableRelatedAgreement2.id,
    });

    expect(nonArchivedAgreementEvent).toMatchObject({
      type: "AgreementAdded",
      event_version: 2,
      version: "0",
      stream_id: relatedAgreements.nonArchivableRelatedAgreement.id,
    });
  }

  it("should throw an agreementNotFound when Agreement not found", async () => {
    await addOneAgreement(getMockAgreement());

    const agreementId = generateId<AgreementId>();
    const authData = getMockAuthData();
    await expect(
      agreementService.submitAgreement(
        agreementId,
        { consumerNotes: "This is a test" },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });

  it("should throw an tenantIsNotTheDelegateConsumer error when requester is not Consumer or Delegate Consumer", async () => {
    const agreement = {
      ...getMockAgreement(),
      state: agreementState.draft,
    };

    const consumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      delegatorId: agreement.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
      eserviceId: agreement.eserviceId,
    });

    await addOneAgreement(agreement);
    await addOneDelegation(consumerDelegation);

    const authData = getMockAuthData(agreement.producerId);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      tenantIsNotTheDelegateConsumer(
        authData.organizationId,
        consumerDelegation.id
      )
    );
  });

  it("should throw tenantIsNotTheDelegateConsumer when the requester is the Consumer but there is a Consumer Delegation", async () => {
    const agreement = {
      ...getMockAgreement(),
      state: agreementState.draft,
    };

    const consumerDelegation = getMockDelegation({
      kind: delegationKind.delegatedConsumer,
      delegatorId: agreement.consumerId,
      delegateId: generateId<TenantId>(),
      state: delegationState.active,
      eserviceId: agreement.eserviceId,
    });

    await addOneAgreement(agreement);
    await addOneDelegation(consumerDelegation);

    const authData = getMockAuthData(agreement.consumerId);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      tenantIsNotTheDelegateConsumer(
        authData.organizationId,
        consumerDelegation.id
      )
    );
  });

  it("should throw an agreementNotInExpectedState error when the agreement is state different from DRAFT", async () => {
    const consumer = getMockTenant();
    const producer = getMockTenant();

    const agreement = {
      ...getMockAgreement(
        generateId<EServiceId>(),
        consumer.id,
        randomArrayItem(
          Object.values(agreementState).filter(
            (s) => s !== agreementState.draft
          )
        )
      ),
      producerId: producer.id,
    };
    await addOneAgreement(agreement);

    const authData = getMockAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement.id, agreement.state)
    );
  });

  it("should throw an agreementAlreadyExists error when a conflicting agreement already exists", async () => {
    const consumer = getMockTenant();
    const producer = getMockTenant();

    const agreement = {
      ...getMockAgreement(generateId<EServiceId>(), consumer.id),
      state: agreementState.draft,
      producerId: producer.id,
    };

    const pendingAgreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementSubmissionConflictingStates),
      consumerId: agreement.consumerId,
      producerId: agreement.producerId,
      eserviceId: agreement.eserviceId,
    };

    await addOneAgreement(agreement);
    await addOneAgreement(pendingAgreement);

    const authData = getMockAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      agreementAlreadyExists(consumer.id, agreement.eserviceId)
    );
  });

  it("should throw a consumerWithNotValidEmail error when consumer doesn't have a contact email", async () => {
    const consumer = {
      ...getMockTenant(),
      mails: [],
    };
    const producer = getMockTenant();

    const agreement = {
      ...getMockAgreement(
        generateId<EServiceId>(),
        consumer.id,
        agreementState.draft
      ),
      producerId: producer.id,
    };
    await addOneTenant(consumer);
    await addOneAgreement(agreement);

    const authData = getMockAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      consumerWithNotValidEmail(agreement.id, consumer.id)
    );
  });

  it("should throw a consumerWithNotValidEmail error when the consumer has only a different mail kind", async () => {
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.DigitalAddress,
          address: "A fake digital Address",
          createdAt: new Date(),
        },
      ],
    };
    const producer = getMockTenant();

    const agreement = {
      ...getMockAgreement(
        generateId<EServiceId>(),
        consumer.id,
        agreementState.draft
      ),
      producerId: producer.id,
    };
    await addOneTenant(consumer);
    await addOneAgreement(agreement);

    const authData = getMockAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      consumerWithNotValidEmail(agreement.id, consumer.id)
    );
  });

  it("should throw an eServiceNotFound error when eservice does not exist", async () => {
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "test@test.com",
          createdAt: new Date(),
        },
      ],
    };
    const producer = getMockTenant();

    const agreement = {
      ...getMockAgreement(),
      consumerId: consumer.id,
      producerId: producer.id,
    };

    await addOneTenant(consumer);
    await addOneAgreement(agreement);

    const authData = getMockAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));
  });

  it("should throw a notLatestEServiceDescriptor error when eservice has only draft descriptors (no active descriptors)", async () => {
    const producer = getMockTenant();
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "test@test.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.draft,
    };
    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAgreement(agreement);

    const authData = getMockAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(notLatestEServiceDescriptor(agreement.descriptorId));
  });

  it("should throw a notLatestEServiceDescriptor error when eservice has only a waiting for approval descriptor (no active descriptors)", async () => {
    const producer = getMockTenant();
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "test@test.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.waitingForApproval,
    };
    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAgreement(agreement);

    const authData = getMockAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(notLatestEServiceDescriptor(agreement.descriptorId));
  });

  it("should throw a notLatestEServiceDescriptor error when the agreement descriptor does not exist in the eservice descriptors", async () => {
    const producer = getMockTenant();
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "test@test.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };
    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: generateId<DescriptorId>(),
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAgreement(agreement);

    const authData = getMockAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(notLatestEServiceDescriptor(agreement.descriptorId));
  });

  it("should throw a notLatestEServiceDescriptor error when the agreement descriptor is not the latest published", async () => {
    const producer = getMockTenant();
    const descriptorId = generateId<DescriptorId>();
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "test@test.com",
          createdAt: new Date(),
        },
      ],
    };

    const oldDescriptor = {
      ...getMockDescriptor(),
      id: descriptorId,
      state: randomArrayItem(
        Object.values(descriptorState).filter(
          (state: DescriptorState) =>
            state !== descriptorState.draft &&
            state !== descriptorState.waitingForApproval
        )
      ),
      version: "1",
    };

    const newDescriptor = {
      ...getMockDescriptor(),
      state: randomArrayItem(
        Object.values(descriptorState).filter(
          (state: DescriptorState) =>
            state !== descriptorState.draft &&
            state !== descriptorState.waitingForApproval
        )
      ),
      version: "2",
    };
    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      oldDescriptor,
      newDescriptor,
    ]);

    const agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId,
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAgreement(agreement);

    const authData = getMockAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(notLatestEServiceDescriptor(agreement.descriptorId));
  });

  it("should throw a descriptorNotInExpectedState error when eservice latest descriptor has invalid state", async () => {
    const producer = getMockTenant();
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "test@test.com",
          createdAt: new Date(),
        },
      ],
    };

    const allowedState: DescriptorState[] = [descriptorState.published];
    const descriptor = {
      ...getMockDescriptor(),
      state: randomArrayItem(
        Object.values(descriptorState).filter(
          (state: DescriptorState) =>
            !allowedState.includes(state) &&
            state !== descriptorState.draft &&
            state !== descriptorState.waitingForApproval
        )
      ),
    };
    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneAgreement(agreement);

    const authData = getMockAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(
      descriptorNotInExpectedState(eservice.id, descriptor.id, allowedState)
    );
  });

  it("should throw a tenantNotFound error when producer does not exist in tenant collection", async () => {
    const producer = getMockTenant();
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "test@test.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };
    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneAgreement(agreement);

    const authData = getMockAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(tenantNotFound(agreement.producerId));
  });

  it("should throw a tenantNotFound error when consumer does not exist in tenant collection", async () => {
    const producer = getMockTenant();
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "test@test.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
    };
    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
    };

    await addOneEService(eservice);
    await addOneTenant(producer);
    await addOneAgreement(agreement);

    const authData = getMockAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(tenantNotFound(agreement.consumerId));
  });

  it("should throw an agreementSubmissionFailed error when new agreement state is not ACTIVE or PENDING", async () => {
    const producer = getMockTenant();
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "test@test.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      attributes: {
        certified: [[getMockEServiceAttribute()]],
        declared: [],
        verified: [],
      },
    };
    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
      state: agreementState.draft,
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAgreement(agreement);

    const authData = getMockAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(agreementSubmissionFailed(agreement.id));
  });

  it("should throw an agreementSubmissionFailed error when recalculation of suspendByPlatform returns true, and also set the agreement to MissingCertifiedAttributes state", async () => {
    const consumerId = generateId<TenantId>();
    const producer = getMockTenant();
    const consumerNotesText = "This is a test";

    const validVerifiedTenantAttribute: TenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: consumerId,
          verificationDate: subDays(new Date(), 1),
          expirationDate: addDays(new Date(), 30),
          extensionDate: undefined,
        },
      ],
      revokedBy: [],
    };

    const consumer = {
      ...getMockTenant(consumerId, [validVerifiedTenantAttribute]),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "test@test.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.published,
      attributes: {
        certified: [[getMockEServiceAttribute()]],
        declared: [],
        verified: [[getMockEServiceAttribute(validVerifiedTenantAttribute.id)]],
      },
    };

    const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
      descriptor,
    ]);

    const agreement: Agreement = {
      ...getMockAgreement(eservice.id, consumer.id),
      producerId: producer.id,
      descriptorId: eservice.descriptors[0].id,
      state: agreementState.draft,
      suspendedByPlatform: false,
    };

    const attribute: Attribute = {
      id: validVerifiedTenantAttribute.id,
      kind: attributeKind.verified,
      description: "A verified attribute",
      name: "A verified attribute name",
      creationTime: subDays(new Date(), 1),
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAttribute(attribute);
    await addOneAgreement(agreement);

    const authData = getMockAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        {
          consumerNotes: consumerNotesText,
        },
        getMockContext({ authData })
      )
    ).rejects.toThrowError(agreementSubmissionFailed(agreement.id));

    const uploadedFiles = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );
    expect(uploadedFiles.length).toEqual(0);

    const actualAgreementData = await readLastAgreementEvent(agreement.id);
    if (!actualAgreementData) {
      fail("Creation fails: agreement not found in event-store");
    }

    expect(actualAgreementData.type).toEqual(
      "AgreementSetMissingCertifiedAttributesByPlatform"
    );
    expect(actualAgreementData).toMatchObject({
      type: "AgreementSetMissingCertifiedAttributesByPlatform",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const actualAgreement: AgreementV2 | undefined = decodeProtobufPayload({
      messageType: AgreementSetMissingCertifiedAttributesByPlatformV2,
      payload: actualAgreementData.data,
    }).agreement;

    if (!actualAgreement) {
      fail("impossible to decode AgreementAddedV1 data");
    }

    expect(actualAgreement.suspendedByPlatform).toBeTruthy();
    expect(actualAgreement.state).toEqual(
      toAgreementStateV2(agreementState.missingCertifiedAttributes)
    );
  });

  it.each(
    Object.values([
      requesterIs.consumer,
      requesterIs.delegateConsumer,
      requesterIs.producer,
      // ^ Producer can submit because it's the same as the consumer
    ])
  )(
    "Requester === %s, should submit agreement with state ACTIVE when producer is equal to consumer, and generate an AgreementActivated event and AgreementArchivedByUpgrade for related agreements",
    async (requesterIs) => {
      const producerAndConsumerId = generateId<TenantId>();
      const producer = {
        ...getMockTenant(producerAndConsumerId),
        mails: [
          {
            id: generateId(),
            kind: tenantMailKind.ContactEmail,
            address: "test1@test1.com",
            createdAt: new Date(),
          },
        ],
      };
      const consumerNotesText = "This is a test";

      const producerAndConsumer = {
        ...getMockTenant(producerAndConsumerId),
        mails: [
          {
            id: generateId(),
            kind: tenantMailKind.ContactEmail,
            address: "test2@test2.com",
            createdAt: new Date(),
          },
        ],
      };

      const descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        attributes: {
          certified: [],
          declared: [],
          verified: [],
        },
      };

      const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
        descriptor,
      ]);

      const agreement: Agreement = {
        ...getMockAgreement(eservice.id, producerAndConsumer.id),
        producerId: producer.id,
        descriptorId: eservice.descriptors[0].id,
        ...draftAgreementSubmissionSeed,
      };

      const {
        authData,
        producerDelegation,
        consumerDelegation,
        delegateProducer,
        delegateConsumer,
      } = authDataAndDelegationsFromRequesterIs(requesterIs, agreement);

      await addOneEService(eservice);
      await addOneTenant(producerAndConsumer);
      await addOneTenant(producer);
      await addOneAgreement(agreement);
      await addSomeRandomDelegations(agreement, addOneDelegation);
      await addDelegationsAndDelegates({
        producerDelegation,
        delegateProducer,
        consumerDelegation,
        delegateConsumer,
      });

      const {
        archivableRelatedAgreement1,
        archivableRelatedAgreement2,
        nonArchivableRelatedAgreement,
      } = await addRelatedAgreements(agreement);

      const agreementSubmitReponse = await agreementService.submitAgreement(
        agreement.id,
        {
          consumerNotes: consumerNotesText,
        },
        getMockContext({ authData })
      );

      const actualAgreementData = await readLastAgreementEvent(agreement.id);

      expect(actualAgreementData).toMatchObject({
        type: "AgreementActivated",
        event_version: 2,
        version: "1",
        stream_id: agreementSubmitReponse.data.id,
      });

      const actualAgreement: AgreementV2 = decodeProtobufPayload({
        messageType: AgreementActivatedV2,
        payload: actualAgreementData.data,
      }).agreement!;

      const uploadedFiles = await fileManager.listFiles(
        config.s3Bucket,
        genericLogger
      );

      expect(uploadedFiles.length).toEqual(0);

      // TODO verify if this logic is correct: we have a resulting agreement
      // in state ACTIVE but with contract undefined and no attributes.
      // https://pagopa.atlassian.net/browse/IMN-623
      expect(agreementSubmitReponse.data.contract).not.toBeDefined();

      const expectedAgreement: Agreement = {
        ...agreement,
        state: agreementState.active,
        consumerNotes: consumerNotesText,
        suspendedByPlatform: false,
        stamps: {
          ...agreement.stamps,
          submission: {
            who: authData.userId,
            when: agreementSubmitReponse.data.stamps?.submission?.when as Date,
            delegationId: consumerDelegation?.id,
          },
          activation: {
            who: authData.userId,
            when: agreementSubmitReponse.data.stamps?.activation?.when as Date,
            delegationId: consumerDelegation?.id,
          },
        },
      };

      expect(fromAgreementV2(actualAgreement)).toEqual(expectedAgreement);
      expect(sortAgreement(agreementSubmitReponse)).toEqual({
        data: sortAgreement(expectedAgreement),
        metadata: { version: 1 },
      });

      await testRelatedAgreementsArchiviation({
        archivableRelatedAgreement1,
        archivableRelatedAgreement2,
        nonArchivableRelatedAgreement,
      });
    }
  );

  describe.each(
    Object.values([
      requesterIs.consumer,
      requesterIs.delegateConsumer,
      requesterIs.producer,
      // ^ Producer can submit because it's the same as the consumer
    ])
  )(
    "Requester === %s, should create a new agreement contract for first activation with new state ACTIVE when producer is equal to consumer, generates AgreementActivated event",
    async (requesterIs) => {
      it.each([true, false])(
        "With producer delegation: %s",
        async (withProducerDelegation) => {
          vi.spyOn(pdfGenerator, "generate");
          const producerAndConsumerId = generateId<TenantId>();
          const consumerNotesText = "This is a test";

          const verifiedAttribute = getMockAttribute("Verified");
          const declaredAttribute = getMockAttribute("Declared");
          const certifiedAttribute = getMockAttribute("Certified");

          const descriptor = {
            ...getMockDescriptor(),
            state: descriptorState.published,
            attributes: {
              certified: [[getMockEServiceAttribute(certifiedAttribute.id)]],
              declared: [[getMockEServiceAttribute(declaredAttribute.id)]],
              verified: [[getMockEServiceAttribute(verifiedAttribute.id)]],
            },
          };

          const eservice = getMockEService(
            generateId<EServiceId>(),
            producerAndConsumerId,
            [descriptor]
          );

          const agreement: Agreement = {
            ...getMockAgreement(eservice.id, producerAndConsumerId),
            producerId: producerAndConsumerId,
            descriptorId: eservice.descriptors[0].id,
            ...draftAgreementSubmissionSeed,
          };

          const { authData, consumerDelegation, delegateConsumer } =
            authDataAndDelegationsFromRequesterIs(requesterIs, agreement);

          const delegateProducer = withProducerDelegation
            ? getMockTenant()
            : undefined;
          const producerDelegation = delegateProducer
            ? getMockDelegation({
                kind: delegationKind.delegatedProducer,
                delegatorId: agreement.producerId,
                delegateId: delegateProducer.id,
                state: delegationState.active,
                eserviceId: agreement.eserviceId,
              })
            : undefined;

          const validVerifiedTenantAttribute: TenantAttribute = {
            ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
            verifiedBy: [
              {
                id: producerAndConsumerId,
                verificationDate: subDays(new Date(), 1),
                expirationDate: addDays(new Date(), 30),
                extensionDate: undefined,
                delegationId: producerDelegation?.id,
              },
            ],
            revokedBy: [],
          };

          const validCertifiedTenantAttribute: TenantAttribute = {
            ...getMockCertifiedTenantAttribute(certifiedAttribute.id),
            revocationTimestamp: undefined,
          };

          const validDeclaredTenantAttribute: TenantAttribute = {
            ...getMockDeclaredTenantAttribute(declaredAttribute.id),
            revocationTimestamp: undefined,
            delegationId: consumerDelegation?.id,
          };

          const producerAndConsumer = {
            ...getMockTenant(producerAndConsumerId, [
              validVerifiedTenantAttribute,
              validCertifiedTenantAttribute,
              validDeclaredTenantAttribute,
            ]),
            mails: [
              {
                id: generateId(),
                kind: tenantMailKind.ContactEmail,
                address: "test@test.com",
                createdAt: new Date(),
              },
            ],
          };

          await addOneEService(eservice);
          await addOneTenant(producerAndConsumer);
          await addOneAttribute(verifiedAttribute);
          await addOneAttribute(declaredAttribute);
          await addOneAttribute(certifiedAttribute);
          await addOneAgreement(agreement);
          await addSomeRandomDelegations(agreement, addOneDelegation);
          await addDelegationsAndDelegates({
            producerDelegation,
            delegateProducer,
            consumerDelegation,
            delegateConsumer,
          });

          const submitAgreementResponse =
            await agreementService.submitAgreement(
              agreement.id,
              {
                consumerNotes: consumerNotesText,
              },
              getMockContext({ authData })
            );

          const uploadedFiles = await fileManager.listFiles(
            config.s3Bucket,
            genericLogger
          );

          expect(uploadedFiles[0]).toEqual(
            submitAgreementResponse.data.contract?.path
          );

          const actualAgreementData = await readLastAgreementEvent(
            agreement.id
          );

          expect(actualAgreementData).toMatchObject({
            type: "AgreementActivated",
            event_version: 2,
            version: "1",
            stream_id: submitAgreementResponse.data.id,
          });

          const actualAgreement: AgreementV2 | undefined =
            decodeProtobufPayload({
              messageType: AgreementActivatedV2,
              payload: actualAgreementData.data,
            }).agreement!;

          const contractDocumentId = submitAgreementResponse.data.contract!.id;
          const contractCreatedAt =
            submitAgreementResponse.data.contract!.createdAt;
          const contractDocumentName = `${producerAndConsumer.id}_${
            producerAndConsumer.id
          }_${formatDateyyyyMMddHHmmss(
            contractCreatedAt
          )}_agreement_contract.pdf`;

          const expectedContract = {
            id: contractDocumentId,
            contentType: "application/pdf",
            createdAt: contractCreatedAt,
            path: `${config.agreementContractsPath}/${agreement.id}/${contractDocumentId}/${contractDocumentName}`,
            prettyName: "Richiesta di fruizione",
            name: contractDocumentName,
          };

          const expectedAgreement = {
            ...agreement,
            state: agreementState.active,
            consumerNotes: consumerNotesText,
            contract: expectedContract,
            suspendedByPlatform: false,
            verifiedAttributes: [
              {
                id: validVerifiedTenantAttribute.id,
              },
            ],
            certifiedAttributes: [
              {
                id: validCertifiedTenantAttribute.id,
              },
            ],
            declaredAttributes: [
              {
                id: validDeclaredTenantAttribute.id,
              },
            ],
            stamps: {
              ...agreement.stamps,
              submission: {
                who: authData.userId,
                when: submitAgreementResponse.data.stamps?.submission?.when,
                delegationId: consumerDelegation?.id,
              },
              activation: {
                who: authData.userId,
                when: submitAgreementResponse.data.stamps?.activation?.when,
                delegationId: consumerDelegation?.id,
              },
            },
          };

          const expectedAgreementPDFPayload: AgreementContractPDFPayload = {
            todayDate: expect.stringMatching(/^\d{2}\/\d{2}\/\d{4}$/),
            todayTime: expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
            agreementId: expectedAgreement.id,
            submitterId: expectedAgreement.stamps.submission.who,
            submissionDate: dateAtRomeZone(
              expectedAgreement.stamps.submission.when!
            ),
            submissionTime: timeAtRomeZone(
              expectedAgreement.stamps.submission.when!
            ),
            activatorId: expectedAgreement.stamps.activation.who,
            activationDate: dateAtRomeZone(
              expectedAgreement.stamps.activation.when!
            ),
            activationTime: timeAtRomeZone(
              expectedAgreement.stamps.activation.when!
            ),
            eserviceId: eservice.id,
            eserviceName: eservice.name,
            descriptorId: eservice.descriptors[0].id,
            descriptorVersion: eservice.descriptors[0].version,
            producerName: producerAndConsumer.name,
            producerIpaCode: producerAndConsumer.externalId.value,
            consumerName: producerAndConsumer.name,
            consumerIpaCode: producerAndConsumer.externalId.value,
            consumerDelegateName: delegateConsumer?.name,
            consumerDelegateIpaCode: delegateConsumer?.externalId.value,
            consumerDelegationId: consumerDelegation?.id,
            producerDelegateName: delegateProducer?.name,
            producerDelegateIpaCode: delegateProducer?.externalId.value,
            producerDelegationId: producerDelegation?.id,
            certifiedAttributes: [
              {
                assignmentDate: dateAtRomeZone(
                  validCertifiedTenantAttribute.assignmentTimestamp
                ),
                assignmentTime: timeAtRomeZone(
                  validCertifiedTenantAttribute.assignmentTimestamp
                ),
                attributeName: certifiedAttribute.name,
                attributeId: validCertifiedTenantAttribute.id,
              },
            ],
            declaredAttributes: [
              {
                assignmentDate: dateAtRomeZone(
                  validDeclaredTenantAttribute.assignmentTimestamp
                ),
                assignmentTime: timeAtRomeZone(
                  validDeclaredTenantAttribute.assignmentTimestamp
                ),
                attributeName: declaredAttribute.name,
                attributeId: validDeclaredTenantAttribute.id,
                delegationId: consumerDelegation?.id,
              },
            ],
            verifiedAttributes: [
              {
                assignmentDate: dateAtRomeZone(
                  validVerifiedTenantAttribute.assignmentTimestamp
                ),
                assignmentTime: timeAtRomeZone(
                  validVerifiedTenantAttribute.assignmentTimestamp
                ),
                attributeName: verifiedAttribute.name,
                attributeId: validVerifiedTenantAttribute.id,
                expirationDate: dateAtRomeZone(
                  validVerifiedTenantAttribute.verifiedBy[0].expirationDate!
                ),
                delegationId: producerDelegation?.id,
              },
            ],
          };

          expect(pdfGenerator.generate).toHaveBeenCalledWith(
            path.resolve(
              path.dirname(fileURLToPath(import.meta.url)),
              "../../src",
              "resources/templates/documents/",
              "agreementContractTemplate.html"
            ),
            expectedAgreementPDFPayload
          );

          expect(
            await fileManager.listFiles(config.s3Bucket, genericLogger)
          ).toContain(expectedContract.path);

          expect(fromAgreementV2(actualAgreement)).toEqual(expectedAgreement);
          expect(submitAgreementResponse).toEqual({
            data: expectedAgreement,
            metadata: { version: 1 },
          });
        }
      );
    }
  );

  it.each(Object.values([requesterIs.consumer, requesterIs.delegateConsumer]))(
    "Requester === %s, should submit agreement contract with new state ACTIVE when producer and consumer are different, and generate an AgreementActivated event and AgreementArchivedByUpgrade for related agreements",
    async (requesterIs) => {
      const consumerId = generateId<TenantId>();
      const producer = {
        ...getMockTenant(consumerId),
        mails: [
          {
            id: generateId(),
            kind: tenantMailKind.ContactEmail,
            address: "test1@test1.com",
            createdAt: new Date(),
          },
        ],
      };
      const consumerNotesText = "This is a test";

      const consumer = {
        ...getMockTenant(consumerId),
        mails: [
          {
            id: generateId(),
            kind: tenantMailKind.ContactEmail,
            address: "test@test.com",
            createdAt: new Date(),
          },
        ],
      };

      const descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        agreementApprovalPolicy: agreementApprovalPolicy.automatic,
        attributes: {
          certified: [],
          declared: [],
          verified: [],
        },
      };

      const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
        descriptor,
      ]);

      const agreement: Agreement = {
        ...getMockAgreement(eservice.id, consumer.id),
        producerId: producer.id,
        descriptorId: eservice.descriptors[0].id,
        ...draftAgreementSubmissionSeed,
      };

      const { authData, consumerDelegation, delegateConsumer } =
        authDataAndDelegationsFromRequesterIs(requesterIs, agreement);

      await addOneEService(eservice);
      await addOneTenant(producer);
      await addOneTenant(consumer);
      await addOneAgreement(agreement);
      await addSomeRandomDelegations(agreement, addOneDelegation);
      await addDelegationsAndDelegates({
        producerDelegation: undefined,
        delegateProducer: undefined,
        consumerDelegation,
        delegateConsumer,
      });

      const {
        archivableRelatedAgreement1,
        archivableRelatedAgreement2,
        nonArchivableRelatedAgreement,
      } = await addRelatedAgreements(agreement);

      const submitAgreementResponse = await agreementService.submitAgreement(
        agreement.id,
        {
          consumerNotes: consumerNotesText,
        },
        getMockContext({ authData })
      );

      const actualAgreementData = await readLastAgreementEvent(agreement.id);

      expect(actualAgreementData).toMatchObject({
        type: "AgreementActivated",
        event_version: 2,
        version: "1",
        stream_id: submitAgreementResponse.data.id,
      });

      const actualAgreement: AgreementV2 | undefined = decodeProtobufPayload({
        messageType: AgreementActivatedV2,
        payload: actualAgreementData.data,
      }).agreement!;

      const uploadedFiles = await fileManager.listFiles(
        config.s3Bucket,
        genericLogger
      );

      expect(uploadedFiles.length).toEqual(0);

      // TODO verify if this logic is correct: we have a resulting agreement
      // in state ACTIVE but with contract undefined and no attributes.
      // https://pagopa.atlassian.net/browse/IMN-623
      expect(submitAgreementResponse.data.contract).not.toBeDefined();

      const expectedAgreement = {
        ...agreement,
        state: agreementState.active,
        consumerNotes: consumerNotesText,
        suspendedByPlatform: false,
        certifiedAttributes: [],
        declaredAttributes: [],
        verifiedAttributes: [],
        stamps: {
          ...agreement.stamps,
          submission: {
            who: authData.userId,
            when: submitAgreementResponse.data.stamps?.submission?.when,
            delegationId: consumerDelegation?.id,
          },
          activation: {
            who: authData.userId,
            when: submitAgreementResponse.data.stamps?.activation?.when,
            delegationId: consumerDelegation?.id,
          },
        },
      };

      expect(fromAgreementV2(actualAgreement)).toEqual(expectedAgreement);
      expect(submitAgreementResponse).toEqual({
        data: expectedAgreement,
        metadata: { version: 1 },
      });

      await testRelatedAgreementsArchiviation({
        archivableRelatedAgreement1,
        archivableRelatedAgreement2,
        nonArchivableRelatedAgreement,
      });
    }
  );

  describe.each(
    Object.values([requesterIs.consumer, requesterIs.delegateConsumer])
  )(
    "Requester === %s, should create a new agreement contract for first activation with new state ACTIVE when producer and consumer are different, generates AgreementActivated",
    async (requesterIs) => {
      it.each([true, false])(
        "With producer delegation: %s",
        async (withProducerDelegation) => {
          vi.spyOn(pdfGenerator, "generate");
          const consumerId = generateId<TenantId>();
          const producer = getMockTenant();
          const consumerNotesText = "This is a test";

          const certifiedAttribute: Attribute = {
            ...getMockAttribute(),
            kind: "Certified",
          };

          const declaredAttribute: Attribute = {
            ...getMockAttribute(),
            kind: "Declared",
          };

          const verifiedAttribute: Attribute = {
            ...getMockAttribute(),
            kind: "Verified",
          };

          const descriptor = {
            ...getMockDescriptor(),
            state: descriptorState.published,
            agreementApprovalPolicy: agreementApprovalPolicy.automatic,
            attributes: {
              certified: [[getMockEServiceAttribute(certifiedAttribute.id)]],
              declared: [[getMockEServiceAttribute(declaredAttribute.id)]],
              verified: [[getMockEServiceAttribute(verifiedAttribute.id)]],
            },
          };

          const eservice = getMockEService(
            generateId<EServiceId>(),
            producer.id,
            [descriptor]
          );

          const agreement: Agreement = {
            ...getMockAgreement(eservice.id, consumerId),
            producerId: producer.id,
            descriptorId: eservice.descriptors[0].id,
            ...draftAgreementSubmissionSeed,
          };

          const { authData, consumerDelegation, delegateConsumer } =
            authDataAndDelegationsFromRequesterIs(requesterIs, agreement);
          const delegateProducer = withProducerDelegation
            ? getMockTenant()
            : undefined;
          const producerDelegation = delegateProducer
            ? getMockDelegation({
                kind: delegationKind.delegatedProducer,
                state: delegationState.active,
                delegatorId: producer.id,
                delegateId: delegateProducer.id,
                eserviceId: eservice.id,
              })
            : undefined;

          const validVerifiedTenantAttribute: TenantAttribute = {
            ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
            verifiedBy: [
              {
                id: producer.id,
                verificationDate: new Date(new Date().getFullYear() - 1),
                expirationDate: undefined,
                extensionDate: undefined,
                delegationId: producerDelegation?.id,
              },
            ],
            revokedBy: [],
          };

          const validCertifiedTenantAttribute: TenantAttribute = {
            ...getMockCertifiedTenantAttribute(certifiedAttribute.id),
            revocationTimestamp: undefined,
          };

          const validDeclaredTenantAttribute: TenantAttribute = {
            ...getMockDeclaredTenantAttribute(declaredAttribute.id),
            revocationTimestamp: undefined,
            delegationId: consumerDelegation?.id,
          };

          const consumer = {
            ...getMockTenant(consumerId, [
              validVerifiedTenantAttribute,
              validCertifiedTenantAttribute,
              validDeclaredTenantAttribute,
            ]),
            mails: [
              {
                id: generateId(),
                kind: tenantMailKind.ContactEmail,
                address: "test@test.com",
                createdAt: new Date(),
              },
            ],
          };

          await addOneEService(eservice);
          await addOneTenant(producer);
          await addOneTenant(consumer);
          await addOneAttribute(verifiedAttribute);
          await addOneAttribute(declaredAttribute);
          await addOneAttribute(certifiedAttribute);
          await addOneAgreement(agreement);
          await addSomeRandomDelegations(agreement, addOneDelegation);
          await addDelegationsAndDelegates({
            producerDelegation,
            delegateProducer,
            consumerDelegation,
            delegateConsumer,
          });

          const submitAgreementResponse =
            await agreementService.submitAgreement(
              agreement.id,
              {
                consumerNotes: consumerNotesText,
              },
              getMockContext({ authData })
            );

          const uploadedFiles = await fileManager.listFiles(
            config.s3Bucket,
            genericLogger
          );

          expect(uploadedFiles[0]).toEqual(
            submitAgreementResponse.data.contract?.path
          );

          const actualAgreementData = await readLastAgreementEvent(
            agreement.id
          );

          expect(actualAgreementData).toMatchObject({
            type: "AgreementActivated",
            event_version: 2,
            version: "1",
            stream_id: submitAgreementResponse.data.id,
          });

          const actualAgreement: AgreementV2 | undefined =
            decodeProtobufPayload({
              messageType: AgreementActivatedV2,
              payload: actualAgreementData.data,
            }).agreement!;

          const contractDocumentId = submitAgreementResponse.data.contract!.id;
          const contractCreatedAt =
            submitAgreementResponse.data.contract!.createdAt;
          const contractDocumentName = `${consumer.id}_${
            producer.id
          }_${formatDateyyyyMMddHHmmss(
            contractCreatedAt
          )}_agreement_contract.pdf`;

          const expectedContract = {
            id: contractDocumentId,
            contentType: "application/pdf",
            createdAt: contractCreatedAt,
            path: `${config.agreementContractsPath}/${agreement.id}/${contractDocumentId}/${contractDocumentName}`,
            prettyName: "Richiesta di fruizione",
            name: contractDocumentName,
          };

          const expectedAgreement = {
            ...agreement,
            state: agreementState.active,
            consumerNotes: consumerNotesText,
            contract: expectedContract,
            suspendedByPlatform: false,
            certifiedAttributes: [
              {
                id: validCertifiedTenantAttribute.id,
              },
            ],
            declaredAttributes: [
              {
                id: validDeclaredTenantAttribute.id,
              },
            ],
            verifiedAttributes: [
              {
                id: validVerifiedTenantAttribute.id,
              },
            ],
            stamps: {
              ...agreement.stamps,
              submission: {
                who: authData.userId,
                when: submitAgreementResponse.data.stamps?.submission?.when,
                delegationId: consumerDelegation?.id,
              },
              activation: {
                who: authData.userId,
                when: submitAgreementResponse.data.stamps?.activation?.when,
                delegationId: consumerDelegation?.id,
              },
            },
          };

          expect(
            await fileManager.listFiles(config.s3Bucket, genericLogger)
          ).toContain(expectedContract.path);

          expect(fromAgreementV2(actualAgreement)).toEqual(expectedAgreement);
          expect(submitAgreementResponse).toEqual({
            data: expectedAgreement,
            metadata: { version: 1 },
          });

          const getIpaCode = (tenant: Tenant): string | undefined =>
            tenant.externalId.origin === PUBLIC_ADMINISTRATIONS_IDENTIFIER
              ? tenant.externalId.value
              : undefined;

          const expectedAgreementPDFPayload: AgreementContractPDFPayload = {
            todayDate: expect.stringMatching(/^\d{2}\/\d{2}\/\d{4}$/),
            todayTime: expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
            agreementId: agreement.id,
            submitterId: authData.userId,
            submissionDate: expect.stringMatching(/^\d{2}\/\d{2}\/\d{4}$/),
            submissionTime: expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
            activatorId: authData.userId,
            activationDate: expect.stringMatching(/^\d{2}\/\d{2}\/\d{4}$/),
            activationTime: expect.stringMatching(/^\d{2}:\d{2}:\d{2}$/),
            eserviceName: eservice.name,
            eserviceId: eservice.id,
            descriptorId: eservice.descriptors[0].id,
            descriptorVersion: eservice.descriptors[0].version,
            producerName: producer.name,
            producerIpaCode: getIpaCode(producer),
            consumerName: consumer.name,
            consumerIpaCode: getIpaCode(consumer),
            certifiedAttributes: [
              {
                assignmentDate: dateAtRomeZone(
                  validCertifiedTenantAttribute.assignmentTimestamp
                ),
                assignmentTime: timeAtRomeZone(
                  validCertifiedTenantAttribute.assignmentTimestamp
                ),
                attributeName: certifiedAttribute.name,
                attributeId: validCertifiedTenantAttribute.id,
              },
            ],
            declaredAttributes: [
              {
                assignmentDate: dateAtRomeZone(
                  validDeclaredTenantAttribute.assignmentTimestamp
                ),
                assignmentTime: timeAtRomeZone(
                  validDeclaredTenantAttribute.assignmentTimestamp
                ),
                attributeName: declaredAttribute.name,
                attributeId: validDeclaredTenantAttribute.id,
                delegationId: consumerDelegation?.id,
              },
            ],
            verifiedAttributes: [
              {
                assignmentDate: dateAtRomeZone(
                  validVerifiedTenantAttribute.assignmentTimestamp
                ),
                assignmentTime: timeAtRomeZone(
                  validVerifiedTenantAttribute.assignmentTimestamp
                ),
                attributeName: verifiedAttribute.name,
                attributeId: validVerifiedTenantAttribute.id,
                expirationDate: undefined,
                delegationId: producerDelegation?.id,
              },
            ],
            producerDelegationId: producerDelegation?.id,
            producerDelegateName: delegateProducer?.name,
            producerDelegateIpaCode: delegateProducer?.externalId.value,
            consumerDelegationId: consumerDelegation?.id,
            consumerDelegateName: delegateConsumer?.name,
            consumerDelegateIpaCode: delegateConsumer?.externalId.value,
          };

          expect(pdfGenerator.generate).toHaveBeenCalledWith(
            path.resolve(
              path.dirname(fileURLToPath(import.meta.url)),
              "../../src",
              "resources/templates/documents/",
              "agreementContractTemplate.html"
            ),
            expectedAgreementPDFPayload
          );
        }
      );
    }
  );

  it.each(Object.values([requesterIs.consumer, requesterIs.delegateConsumer]))(
    "Requester === %s, should submit agreement with new state PENDING when producer is different from consumer and no related agreements exist, and approval policy is manual, generates AgreementSubmitted event",
    async (requesterIs) => {
      const consumerId = generateId<TenantId>();
      const producer = getMockTenant();
      const consumerNotesText = "This is a test";

      const certifiedAttribute: Attribute = {
        ...getMockAttribute(),
        kind: "Certified",
      };

      const declaredAttribute: Attribute = {
        ...getMockAttribute(),
        kind: "Declared",
      };

      const verifiedAttribute: Attribute = {
        ...getMockAttribute(),
        kind: "Verified",
      };

      const descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        agreementApprovalPolicy: agreementApprovalPolicy.manual,
        attributes: {
          certified: [[getMockEServiceAttribute(certifiedAttribute.id)]],
          declared: [[getMockEServiceAttribute(declaredAttribute.id)]],
          verified: [[getMockEServiceAttribute(verifiedAttribute.id)]],
        },
      };
      const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
        descriptor,
      ]);

      const agreement: Agreement = {
        ...getMockAgreement(eservice.id, consumerId),
        producerId: producer.id,
        descriptorId: eservice.descriptors[0].id,
        ...draftAgreementSubmissionSeed,
      };

      const { authData, consumerDelegation, delegateConsumer } =
        authDataAndDelegationsFromRequesterIs(requesterIs, agreement);

      const validVerifiedTenantAttribute: TenantAttribute = {
        ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
        verifiedBy: [
          {
            id: producer.id,
            verificationDate: new Date(new Date().getFullYear() - 1),
            expirationDate: undefined,
            extensionDate: undefined,
            delegationId: undefined,
          },
        ],
        revokedBy: [],
      };

      const validCertifiedTenantAttribute: TenantAttribute = {
        ...getMockCertifiedTenantAttribute(certifiedAttribute.id),
        revocationTimestamp: undefined,
      };

      const validDeclaredTenantAttribute: TenantAttribute = {
        ...getMockDeclaredTenantAttribute(declaredAttribute.id),
        revocationTimestamp: undefined,
        delegationId: consumerDelegation?.id,
      };

      const consumer = {
        ...getMockTenant(consumerId, [
          validCertifiedTenantAttribute,
          validDeclaredTenantAttribute,
          validVerifiedTenantAttribute,
        ]),
        mails: [
          {
            id: generateId(),
            kind: tenantMailKind.ContactEmail,
            address: "test@test.com",
            createdAt: new Date(),
          },
        ],
      };

      await addOneEService(eservice);
      await addOneTenant(producer);
      await addOneTenant(consumer);
      await addOneAttribute(certifiedAttribute);
      await addOneAttribute(declaredAttribute);
      await addOneAttribute(verifiedAttribute);
      await addOneAgreement(agreement);
      await addSomeRandomDelegations(agreement, addOneDelegation);
      await addDelegationsAndDelegates({
        producerDelegation: undefined,
        delegateProducer: undefined,
        consumerDelegation,
        delegateConsumer,
      });

      const submitAgreementResponse = await agreementService.submitAgreement(
        agreement.id,
        {
          consumerNotes: consumerNotesText,
        },
        getMockContext({ authData })
      );

      const actualAgreementData = await readLastAgreementEvent(agreement.id);

      expect(actualAgreementData.type).toEqual("AgreementSubmitted");
      expect(actualAgreementData).toMatchObject({
        type: "AgreementSubmitted",
        event_version: 2,
        version: "1",
        stream_id: submitAgreementResponse.data.id,
      });

      const actualAgreement: AgreementV2 | undefined = decodeProtobufPayload({
        messageType: AgreementSubmittedV2,
        payload: actualAgreementData.data,
      }).agreement!;

      const uploadedFiles = await fileManager.listFiles(
        config.s3Bucket,
        genericLogger
      );

      expect(uploadedFiles.length).toEqual(0);

      expect(submitAgreementResponse.data.contract).not.toBeDefined();

      const expectedAgreement = {
        ...agreement,
        state: agreementState.pending,
        consumerNotes: consumerNotesText,
        certifiedAttributes: [],
        declaredAttributes: [],
        verifiedAttributes: [],
        suspendedByPlatform: false,
        stamps: {
          ...agreement.stamps,
          submission: {
            who: authData.userId,
            when: submitAgreementResponse.data.stamps?.submission?.when,
            delegationId: consumerDelegation?.id,
          },
        },
      };

      expect(fromAgreementV2(actualAgreement)).toEqual(expectedAgreement);
      expect(submitAgreementResponse).toEqual({
        data: expectedAgreement,
        metadata: { version: 1 },
      });
    }
  );

  it.each(Object.values([requesterIs.consumer, requesterIs.delegateConsumer]))(
    "Requester === %s, should submit agreement with new state PENDING when producer is different from consumer and no related agreements exist and verified att are not satisfied, generates AgreementSubmitted event",
    async (requesterIs) => {
      const consumerId = generateId<TenantId>();
      const producer = getMockTenant();
      const consumerNotesText = "This is a test";

      const certifiedAttribute: Attribute = {
        ...getMockAttribute(),
        kind: "Certified",
      };

      const declaredAttribute: Attribute = {
        ...getMockAttribute(),
        kind: "Declared",
      };

      const verifiedAttribute: Attribute = {
        ...getMockAttribute(),
        kind: "Verified",
      };
      const descriptor = {
        ...getMockDescriptor(),
        state: descriptorState.published,
        agreementApprovalPolicy: agreementApprovalPolicy.automatic,
        attributes: {
          certified: [[getMockEServiceAttribute(certifiedAttribute.id)]],
          declared: [[getMockEServiceAttribute(declaredAttribute.id)]],
          verified: [[getMockEServiceAttribute(verifiedAttribute.id)]],
        },
      };
      const eservice = getMockEService(generateId<EServiceId>(), producer.id, [
        descriptor,
      ]);

      const agreement: Agreement = {
        ...getMockAgreement(eservice.id, consumerId),
        producerId: producer.id,
        descriptorId: eservice.descriptors[0].id,
        ...draftAgreementSubmissionSeed,
      };

      const { authData, consumerDelegation, delegateConsumer } =
        authDataAndDelegationsFromRequesterIs(requesterIs, agreement);

      const certifiedTenantAttribute: TenantAttribute = {
        ...getMockCertifiedTenantAttribute(certifiedAttribute.id),
        revocationTimestamp: undefined,
      };
      const declareTenantAttribute: TenantAttribute = {
        ...getMockDeclaredTenantAttribute(declaredAttribute.id),
        revocationTimestamp: undefined,
      };

      const invalidVerifiedTenantAttribute: TenantAttribute = {
        ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
        verifiedBy: [
          {
            id: producer.id,
            verificationDate: new Date(new Date().getFullYear() - 1),
            expirationDate: subDays(new Date(), 1),
            extensionDate: subDays(new Date(), 1),
          },
        ],
        revokedBy: [],
      };
      const consumer = {
        ...getMockTenant(consumerId, [
          certifiedTenantAttribute,
          declareTenantAttribute,
          invalidVerifiedTenantAttribute,
        ]),
        mails: [
          {
            id: generateId(),
            kind: tenantMailKind.ContactEmail,
            address: "test@test.com",
            createdAt: new Date(),
          },
        ],
      };

      await addOneEService(eservice);
      await addOneTenant(producer);
      await addOneTenant(consumer);
      await addOneAttribute(certifiedAttribute);
      await addOneAttribute(declaredAttribute);
      await addOneAttribute(verifiedAttribute);
      await addOneAgreement(agreement);
      await addSomeRandomDelegations(agreement, addOneDelegation);
      await addDelegationsAndDelegates({
        producerDelegation: undefined,
        delegateProducer: undefined,
        consumerDelegation,
        delegateConsumer,
      });

      const submitAgreementResponse = await agreementService.submitAgreement(
        agreement.id,
        {
          consumerNotes: consumerNotesText,
        },
        getMockContext({ authData })
      );

      const actualAgreementData = await readLastAgreementEvent(agreement.id);

      expect(actualAgreementData).toMatchObject({
        type: "AgreementSubmitted",
        event_version: 2,
        version: "1",
        stream_id: submitAgreementResponse.data.id,
      });

      const actualAgreement: AgreementV2 | undefined = decodeProtobufPayload({
        messageType: AgreementSubmittedV2,
        payload: actualAgreementData.data,
      }).agreement!;

      const uploadedFiles = await fileManager.listFiles(
        config.s3Bucket,
        genericLogger
      );

      expect(submitAgreementResponse.data.contract).not.toBeDefined();
      expect(uploadedFiles.length).toEqual(0);

      const expectedAgreement = {
        ...agreement,
        state: agreementState.pending,
        consumerNotes: consumerNotesText,
        certifiedAttributes: [],
        declaredAttributes: [],
        verifiedAttributes: [],
        suspendedByPlatform: false,
        stamps: {
          ...agreement.stamps,
          submission: {
            who: authData.userId,
            when: submitAgreementResponse.data.stamps?.submission?.when,
            delegationId: consumerDelegation?.id,
          },
        },
      };

      expect(fromAgreementV2(actualAgreement)).toEqual(expectedAgreement);
      expect(submitAgreementResponse).toEqual({
        data: expectedAgreement,
        metadata: { version: 1 },
      });
    }
  );

  // ============================================================================
  // SUSPENDED DRAFT AGREEMENT SUBMISSION TESTS
  // These tests verify the behavior when submitting a draft agreement that has
  // suspension flags set (from a previous upgrade operation).
  //
  // Key behavior:
  // - When producer === consumer AND requester is the tenant itself, the requester
  //   matches BOTH the consumer and producer checks, so both suspension flags
  //   are computed as FALSE (since target state is ACTIVE). Agreement goes to ACTIVE.
  //   However, the STORED flags are preserved from the draft agreement.
  // - When producer !== consumer, the producer's suspension flag is preserved
  //   (not computed) because the consumer is not the producer.
  // - Suspension flags in the stored agreement come from the original draft,
  //   while the state is computed using the computed flags.
  // ============================================================================

  describe("Suspended draft agreement submission - Producer === Consumer", () => {
    // When producer === consumer AND requester is the tenant itself,
    // the requester matches both consumer and producer checks, so both
    // suspension flags are computed based on target state (ACTIVE !== SUSPENDED = FALSE).
    // This results in state = ACTIVE.
    // The STORED flags are preserved from the draft agreement.
    describe.each([
      {
        seed: suspendedByConsumerOnlySeed,
        description: "suspendedByConsumer only",
        expectedSuspendedByConsumer: true,
        expectedSuspendedByProducer: false,
      },
      {
        seed: suspendedByProducerOnlySeed,
        description: "suspendedByProducer only",
        expectedSuspendedByConsumer: false,
        expectedSuspendedByProducer: true,
      },
      {
        seed: suspendedByBothSeed,
        description: "suspendedByBoth",
        expectedSuspendedByConsumer: true,
        expectedSuspendedByProducer: true,
      },
    ])(
      "Suspension flags: $description - requester is the tenant itself",
      ({ seed, expectedSuspendedByConsumer, expectedSuspendedByProducer }) => {
        it.each([requesterIs.consumer, requesterIs.producer])(
          "Requester === %s, should submit as ACTIVE with suspension flags preserved from draft",
          async (requester) => {
            const producerAndConsumerId = generateId<TenantId>();
            const consumerNotesText = "This is a test";

            const verifiedAttribute = getMockAttribute("Verified");
            const declaredAttribute = getMockAttribute("Declared");
            const certifiedAttribute = getMockAttribute("Certified");

            const descriptor = {
              ...getMockDescriptor(),
              state: descriptorState.published,
              attributes: {
                certified: [[getMockEServiceAttribute(certifiedAttribute.id)]],
                declared: [[getMockEServiceAttribute(declaredAttribute.id)]],
                verified: [[getMockEServiceAttribute(verifiedAttribute.id)]],
              },
            };

            const eservice = getMockEService(
              generateId<EServiceId>(),
              producerAndConsumerId,
              [descriptor]
            );

            const agreement: Agreement = {
              ...getMockAgreement(eservice.id, producerAndConsumerId),
              producerId: producerAndConsumerId,
              descriptorId: eservice.descriptors[0].id,
              ...seed,
            };

            const { authData, consumerDelegation, delegateConsumer } =
              authDataAndDelegationsFromRequesterIs(requester, agreement);

            const validVerifiedTenantAttribute: TenantAttribute = {
              ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
              verifiedBy: [
                {
                  id: producerAndConsumerId,
                  verificationDate: subDays(new Date(), 1),
                  expirationDate: addDays(new Date(), 30),
                  extensionDate: undefined,
                  delegationId: undefined,
                },
              ],
              revokedBy: [],
            };

            const validCertifiedTenantAttribute: TenantAttribute = {
              ...getMockCertifiedTenantAttribute(certifiedAttribute.id),
              revocationTimestamp: undefined,
            };

            const validDeclaredTenantAttribute: TenantAttribute = {
              ...getMockDeclaredTenantAttribute(declaredAttribute.id),
              revocationTimestamp: undefined,
              delegationId: consumerDelegation?.id,
            };

            const producerAndConsumer = {
              ...getMockTenant(producerAndConsumerId, [
                validVerifiedTenantAttribute,
                validCertifiedTenantAttribute,
                validDeclaredTenantAttribute,
              ]),
              mails: [
                {
                  id: generateId(),
                  kind: tenantMailKind.ContactEmail,
                  address: "test@test.com",
                  createdAt: new Date(),
                },
              ],
            };

            await addOneEService(eservice);
            await addOneTenant(producerAndConsumer);
            await addOneAttribute(verifiedAttribute);
            await addOneAttribute(declaredAttribute);
            await addOneAttribute(certifiedAttribute);
            await addOneAgreement(agreement);
            await addSomeRandomDelegations(agreement, addOneDelegation);
            await addDelegationsAndDelegates({
              producerDelegation: undefined,
              delegateProducer: undefined,
              consumerDelegation,
              delegateConsumer,
            });

            const submitAgreementResponse =
              await agreementService.submitAgreement(
                agreement.id,
                { consumerNotes: consumerNotesText },
                getMockContext({ authData })
              );

            // When producer === consumer and requester is the tenant itself,
            // the state is ACTIVE because computed flags are FALSE.
            // But stored flags are preserved from the draft agreement.
            expect(submitAgreementResponse.data.state).toBe(
              agreementState.active
            );
            expect(submitAgreementResponse.data.suspendedByConsumer).toBe(
              expectedSuspendedByConsumer
            );
            expect(submitAgreementResponse.data.suspendedByProducer).toBe(
              expectedSuspendedByProducer
            );
            expect(submitAgreementResponse.data.contract).toBeDefined();

            const actualAgreementData = await readLastAgreementEvent(
              agreement.id
            );
            expect(actualAgreementData.type).toBe("AgreementActivated");
          }
        );
      }
    );

    // When producer === consumer AND requester is a delegate consumer,
    // the delegate consumer's check matches the consumer side but NOT the producer side.
    // - Consumer flag: computed as FALSE (delegate can act as consumer, target is active)
    // - Producer flag: PRESERVED from draft (delegate is not the producer)
    // If preserved producer flag is TRUE → state = SUSPENDED
    // If preserved producer flag is FALSE → state = ACTIVE
    describe.each([
      {
        seed: suspendedByConsumerOnlySeed,
        description: "suspendedByConsumer only",
        expectedSuspendedByConsumer: true,
        expectedSuspendedByProducer: false,
        expectedState: agreementState.active,
        expectedEvent: "AgreementActivated",
      },
      {
        seed: suspendedByProducerOnlySeed,
        description: "suspendedByProducer only",
        expectedSuspendedByConsumer: false,
        expectedSuspendedByProducer: true,
        expectedState: agreementState.suspended,
        expectedEvent: "AgreementSubmitted",
      },
      {
        seed: suspendedByBothSeed,
        description: "suspendedByBoth",
        expectedSuspendedByConsumer: true,
        expectedSuspendedByProducer: true,
        expectedState: agreementState.suspended,
        expectedEvent: "AgreementSubmitted",
      },
    ])(
      "Suspension flags: $description - requester is delegate",
      ({ seed, expectedSuspendedByConsumer, expectedSuspendedByProducer, expectedState, expectedEvent }) => {
        it.each([true, false])(
          "Requester === delegateConsumer, with producer delegation: %s",
          async (withProducerDelegation) => {
            const producerAndConsumerId = generateId<TenantId>();
            const consumerNotesText = "This is a test";

            const verifiedAttribute = getMockAttribute("Verified");
            const declaredAttribute = getMockAttribute("Declared");
            const certifiedAttribute = getMockAttribute("Certified");

            const descriptor = {
              ...getMockDescriptor(),
              state: descriptorState.published,
              attributes: {
                certified: [[getMockEServiceAttribute(certifiedAttribute.id)]],
                declared: [[getMockEServiceAttribute(declaredAttribute.id)]],
                verified: [[getMockEServiceAttribute(verifiedAttribute.id)]],
              },
            };

            const eservice = getMockEService(
              generateId<EServiceId>(),
              producerAndConsumerId,
              [descriptor]
            );

            const agreement: Agreement = {
              ...getMockAgreement(eservice.id, producerAndConsumerId),
              producerId: producerAndConsumerId,
              descriptorId: eservice.descriptors[0].id,
              ...seed,
            };

            const { authData, consumerDelegation, delegateConsumer } =
              authDataAndDelegationsFromRequesterIs(
                requesterIs.delegateConsumer,
                agreement
              );

            const delegateProducer = withProducerDelegation
              ? getMockTenant()
              : undefined;
            const producerDelegation = delegateProducer
              ? getMockDelegation({
                  kind: delegationKind.delegatedProducer,
                  delegatorId: agreement.producerId,
                  delegateId: delegateProducer.id,
                  state: delegationState.active,
                  eserviceId: agreement.eserviceId,
                })
              : undefined;

            const validVerifiedTenantAttribute: TenantAttribute = {
              ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
              verifiedBy: [
                {
                  id: producerAndConsumerId,
                  verificationDate: subDays(new Date(), 1),
                  expirationDate: addDays(new Date(), 30),
                  extensionDate: undefined,
                  delegationId: producerDelegation?.id,
                },
              ],
              revokedBy: [],
            };

            const validCertifiedTenantAttribute: TenantAttribute = {
              ...getMockCertifiedTenantAttribute(certifiedAttribute.id),
              revocationTimestamp: undefined,
            };

            const validDeclaredTenantAttribute: TenantAttribute = {
              ...getMockDeclaredTenantAttribute(declaredAttribute.id),
              revocationTimestamp: undefined,
              delegationId: consumerDelegation?.id,
            };

            const producerAndConsumer = {
              ...getMockTenant(producerAndConsumerId, [
                validVerifiedTenantAttribute,
                validCertifiedTenantAttribute,
                validDeclaredTenantAttribute,
              ]),
              mails: [
                {
                  id: generateId(),
                  kind: tenantMailKind.ContactEmail,
                  address: "test@test.com",
                  createdAt: new Date(),
                },
              ],
            };

            await addOneEService(eservice);
            await addOneTenant(producerAndConsumer);
            await addOneAttribute(verifiedAttribute);
            await addOneAttribute(declaredAttribute);
            await addOneAttribute(certifiedAttribute);
            await addOneAgreement(agreement);
            await addSomeRandomDelegations(agreement, addOneDelegation);
            await addDelegationsAndDelegates({
              producerDelegation,
              delegateProducer,
              consumerDelegation,
              delegateConsumer,
            });

            const submitAgreementResponse =
              await agreementService.submitAgreement(
                agreement.id,
                { consumerNotes: consumerNotesText },
                getMockContext({ authData })
              );

            // When producer === consumer and delegate submits:
            // - Consumer flag is computed as FALSE (delegate acts as consumer, target is active)
            // - Producer flag is PRESERVED from draft (delegate is not producer)
            // If preserved producer flag is TRUE → state = SUSPENDED
            // If preserved producer flag is FALSE → state = ACTIVE
            expect(submitAgreementResponse.data.state).toBe(expectedState);
            expect(submitAgreementResponse.data.suspendedByConsumer).toBe(
              expectedSuspendedByConsumer
            );
            expect(submitAgreementResponse.data.suspendedByProducer).toBe(
              expectedSuspendedByProducer
            );

            const actualAgreementData = await readLastAgreementEvent(
              agreement.id
            );
            expect(actualAgreementData.type).toBe(expectedEvent);
          }
        );
      }
    );
  });

  describe("Suspended draft agreement submission - Producer !== Consumer", () => {
    // When producer !== consumer with automatic approval policy,
    // the consumer submitting cannot clear the producer's suspension flag.
    // - Consumer flag: computed as FALSE (requester is consumer, target is active)
    // - Producer flag: PRESERVED from draft (requester is not producer)
    // If preserved producer flag is TRUE → state = SUSPENDED
    // If preserved producer flag is FALSE → state = ACTIVE
    describe.each([
      {
        seed: suspendedByConsumerOnlySeed,
        description: "suspendedByConsumer only",
        expectedSuspendedByConsumer: true,
        expectedSuspendedByProducer: false,
        expectedState: agreementState.active,
        expectedEvent: "AgreementActivated",
      },
      {
        seed: suspendedByProducerOnlySeed,
        description: "suspendedByProducer only",
        expectedSuspendedByConsumer: false,
        expectedSuspendedByProducer: true,
        expectedState: agreementState.suspended,
        expectedEvent: "AgreementSubmitted",
      },
      {
        seed: suspendedByBothSeed,
        description: "suspendedByBoth",
        expectedSuspendedByConsumer: true,
        expectedSuspendedByProducer: true,
        expectedState: agreementState.suspended,
        expectedEvent: "AgreementSubmitted",
      },
    ])(
      "Suspension flags: $description - automatic approval",
      ({ seed, expectedSuspendedByConsumer, expectedSuspendedByProducer, expectedState, expectedEvent }) => {
        it.each([requesterIs.consumer, requesterIs.delegateConsumer])(
          "Requester === %s, should preserve suspension flags",
          async (requester) => {
            const consumerId = generateId<TenantId>();
            const producer = getMockTenant();
            const consumerNotesText = "This is a test";

            const verifiedAttribute = getMockAttribute("Verified");
            const declaredAttribute = getMockAttribute("Declared");
            const certifiedAttribute = getMockAttribute("Certified");

            const descriptor = {
              ...getMockDescriptor(),
              state: descriptorState.published,
              agreementApprovalPolicy: agreementApprovalPolicy.automatic,
              attributes: {
                certified: [[getMockEServiceAttribute(certifiedAttribute.id)]],
                declared: [[getMockEServiceAttribute(declaredAttribute.id)]],
                verified: [[getMockEServiceAttribute(verifiedAttribute.id)]],
              },
            };

            const eservice = getMockEService(
              generateId<EServiceId>(),
              producer.id,
              [descriptor]
            );

            const agreement: Agreement = {
              ...getMockAgreement(eservice.id, consumerId),
              producerId: producer.id,
              descriptorId: eservice.descriptors[0].id,
              ...seed,
            };

            const { authData, consumerDelegation, delegateConsumer } =
              authDataAndDelegationsFromRequesterIs(requester, agreement);

            const validVerifiedTenantAttribute: TenantAttribute = {
              ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
              verifiedBy: [
                {
                  id: producer.id,
                  verificationDate: subDays(new Date(), 1),
                  expirationDate: addDays(new Date(), 30),
                  extensionDate: undefined,
                  delegationId: undefined,
                },
              ],
              revokedBy: [],
            };

            const validCertifiedTenantAttribute: TenantAttribute = {
              ...getMockCertifiedTenantAttribute(certifiedAttribute.id),
              revocationTimestamp: undefined,
            };

            const validDeclaredTenantAttribute: TenantAttribute = {
              ...getMockDeclaredTenantAttribute(declaredAttribute.id),
              revocationTimestamp: undefined,
              delegationId: consumerDelegation?.id,
            };

            const consumer = {
              ...getMockTenant(consumerId, [
                validVerifiedTenantAttribute,
                validCertifiedTenantAttribute,
                validDeclaredTenantAttribute,
              ]),
              mails: [
                {
                  id: generateId(),
                  kind: tenantMailKind.ContactEmail,
                  address: "test@test.com",
                  createdAt: new Date(),
                },
              ],
            };

            await addOneEService(eservice);
            await addOneTenant(producer);
            await addOneTenant(consumer);
            await addOneAttribute(verifiedAttribute);
            await addOneAttribute(declaredAttribute);
            await addOneAttribute(certifiedAttribute);
            await addOneAgreement(agreement);
            await addSomeRandomDelegations(agreement, addOneDelegation);
            await addDelegationsAndDelegates({
              producerDelegation: undefined,
              delegateProducer: undefined,
              consumerDelegation,
              delegateConsumer,
            });

            const submitAgreementResponse =
              await agreementService.submitAgreement(
                agreement.id,
                { consumerNotes: consumerNotesText },
                getMockContext({ authData })
              );

            // Verify that suspension flags are preserved from the draft
            expect(submitAgreementResponse.data.suspendedByConsumer).toBe(
              expectedSuspendedByConsumer
            );
            expect(submitAgreementResponse.data.suspendedByProducer).toBe(
              expectedSuspendedByProducer
            );

            // When producer !== consumer:
            // - Consumer flag is computed as FALSE (requester is consumer, target is active)
            // - Producer flag is PRESERVED from draft
            // If preserved producer flag is TRUE → state = SUSPENDED
            // If preserved producer flag is FALSE → state = ACTIVE
            expect(submitAgreementResponse.data.state).toBe(expectedState);

            const actualAgreementData = await readLastAgreementEvent(
              agreement.id
            );
            expect(actualAgreementData.type).toBe(expectedEvent);
          }
        );
      }
    );

    // When producer !== consumer with manual approval policy,
    // agreement goes to PENDING with suspension flags preserved.
    describe.each([
      {
        seed: suspendedByConsumerOnlySeed,
        description: "suspendedByConsumer only",
        expectedSuspendedByConsumer: true,
        expectedSuspendedByProducer: false,
      },
      {
        seed: suspendedByProducerOnlySeed,
        description: "suspendedByProducer only",
        expectedSuspendedByConsumer: false,
        expectedSuspendedByProducer: true,
      },
      {
        seed: suspendedByBothSeed,
        description: "suspendedByBoth",
        expectedSuspendedByConsumer: true,
        expectedSuspendedByProducer: true,
      },
    ])(
      "Suspension flags: $description - manual approval",
      ({ seed, expectedSuspendedByConsumer, expectedSuspendedByProducer }) => {
        it.each([requesterIs.consumer, requesterIs.delegateConsumer])(
          "Requester === %s, should submit as PENDING with flags preserved",
          async (requester) => {
            const consumerId = generateId<TenantId>();
            const producer = getMockTenant();
            const consumerNotesText = "This is a test";

            const verifiedAttribute = getMockAttribute("Verified");
            const declaredAttribute = getMockAttribute("Declared");
            const certifiedAttribute = getMockAttribute("Certified");

            const descriptor = {
              ...getMockDescriptor(),
              state: descriptorState.published,
              agreementApprovalPolicy: agreementApprovalPolicy.manual,
              attributes: {
                certified: [[getMockEServiceAttribute(certifiedAttribute.id)]],
                declared: [[getMockEServiceAttribute(declaredAttribute.id)]],
                verified: [[getMockEServiceAttribute(verifiedAttribute.id)]],
              },
            };

            const eservice = getMockEService(
              generateId<EServiceId>(),
              producer.id,
              [descriptor]
            );

            const agreement: Agreement = {
              ...getMockAgreement(eservice.id, consumerId),
              producerId: producer.id,
              descriptorId: eservice.descriptors[0].id,
              ...seed,
            };

            const { authData, consumerDelegation, delegateConsumer } =
              authDataAndDelegationsFromRequesterIs(requester, agreement);

            const validVerifiedTenantAttribute: TenantAttribute = {
              ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
              verifiedBy: [
                {
                  id: producer.id,
                  verificationDate: subDays(new Date(), 1),
                  expirationDate: undefined,
                  extensionDate: undefined,
                  delegationId: undefined,
                },
              ],
              revokedBy: [],
            };

            const validCertifiedTenantAttribute: TenantAttribute = {
              ...getMockCertifiedTenantAttribute(certifiedAttribute.id),
              revocationTimestamp: undefined,
            };

            const validDeclaredTenantAttribute: TenantAttribute = {
              ...getMockDeclaredTenantAttribute(declaredAttribute.id),
              revocationTimestamp: undefined,
              delegationId: consumerDelegation?.id,
            };

            const consumer = {
              ...getMockTenant(consumerId, [
                validVerifiedTenantAttribute,
                validCertifiedTenantAttribute,
                validDeclaredTenantAttribute,
              ]),
              mails: [
                {
                  id: generateId(),
                  kind: tenantMailKind.ContactEmail,
                  address: "test@test.com",
                  createdAt: new Date(),
                },
              ],
            };

            await addOneEService(eservice);
            await addOneTenant(producer);
            await addOneTenant(consumer);
            await addOneAttribute(verifiedAttribute);
            await addOneAttribute(declaredAttribute);
            await addOneAttribute(certifiedAttribute);
            await addOneAgreement(agreement);
            await addSomeRandomDelegations(agreement, addOneDelegation);
            await addDelegationsAndDelegates({
              producerDelegation: undefined,
              delegateProducer: undefined,
              consumerDelegation,
              delegateConsumer,
            });

            const submitAgreementResponse =
              await agreementService.submitAgreement(
                agreement.id,
                { consumerNotes: consumerNotesText },
                getMockContext({ authData })
              );

            // With manual approval, agreement goes to PENDING
            // Suspension flags are still preserved
            expect(submitAgreementResponse.data.state).toBe(
              agreementState.pending
            );
            expect(submitAgreementResponse.data.suspendedByConsumer).toBe(
              expectedSuspendedByConsumer
            );
            expect(submitAgreementResponse.data.suspendedByProducer).toBe(
              expectedSuspendedByProducer
            );
            expect(submitAgreementResponse.data.contract).toBeUndefined();

            const actualAgreementData = await readLastAgreementEvent(
              agreement.id
            );
            expect(actualAgreementData.type).toBe("AgreementSubmitted");
          }
        );
      }
    );
  });
});
