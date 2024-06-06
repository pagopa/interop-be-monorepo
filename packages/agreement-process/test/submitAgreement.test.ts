/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
import { randomUUID } from "crypto";
import { fail } from "assert";
import {
  getRandomAuthData,
  getMockTenant,
  getMockAgreement,
  randomArrayItem,
  getMockEService,
  getMockDescriptor,
  getMockEServiceAttribute,
  decodeProtobufPayload,
  getMockVerifiedTenantAttribute,
  getMockCertifiedTenantAttribute,
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
  SelfcareId,
  TenantAttribute,
  TenantId,
  agreementApprovalPolicy,
  agreementState,
  attributeKind,
  descriptorState,
  generateId,
  tenantMailKind,
  toAgreementStateV2,
} from "pagopa-interop-models";
import { afterEach, describe, expect, it, vi } from "vitest";
import { genericLogger } from "pagopa-interop-commons";
import { UserResponse } from "pagopa-interop-selfcare-v2-client";
import {
  agreementAlreadyExists,
  agreementMissingUserInfo,
  agreementNotFound,
  agreementNotInExpectedState,
  agreementSelfcareIdNotFound,
  agreementSubmissionFailed,
  consumerWithNotValidEmail,
  descriptorNotInExpectedState,
  eServiceNotFound,
  notLatestEServiceDescriptor,
  operationNotAllowed,
  tenantNotFound,
  userNotFound,
} from "../src/model/domain/errors.js";
import { agreementSubmissionConflictingStates } from "../src/model/domain/validators.js";
import { config } from "../src/utilities/config.js";
import {
  agreementService,
  addOneAgreement,
  addOneTenant,
  addOneEService,
  selfcareV2ClientMock,
  fileManager,
  readLastAgreementEvent,
  addOneAttribute,
} from "./utils.js";

describe("submit agreement", () => {
  const mockSelfCareResponse = (userResponse?: UserResponse): void => {
    if (userResponse) {
      selfcareV2ClientMock.getUserInfoUsingGET = vi.fn(
        async () => userResponse
      );
    } else {
      selfcareV2ClientMock.getUserInfoUsingGET = vi.fn(
        async () => undefined as unknown as UserResponse // this should never happend
      );
    }
  };

  afterEach(async () => {
    vi.clearAllMocks();
  });

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
    const authData = getRandomAuthData();
    await expect(
      agreementService.submitAgreement(
        agreementId,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: randomUUID(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });

  it("should throw an operationNotAllowed error when requester is not consumer", async () => {
    const consumer = getMockTenant();
    const producer = getMockTenant();

    const agreement = getMockAgreement(
      generateId<EServiceId>(),
      consumer.id,
      agreementState.draft
    );

    await addOneAgreement(agreement);

    const authData = getRandomAuthData(producer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: randomUUID(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should throw an agreementNotInExpectedState error when have not submittable state", async () => {
    const consumer = getMockTenant();
    const producer = getMockTenant();

    const agreement = {
      ...getMockAgreement(
        generateId<EServiceId>(),
        consumer.id,
        randomArrayItem(agreementSubmissionConflictingStates)
      ),
      producerId: producer.id,
    };
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: randomUUID(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement.id, agreement.state)
    );
  });

  it("should throw an agreementAlreadyExists error when agreement already exists", async () => {
    const consumer = getMockTenant();
    const producer = getMockTenant();

    const agreement = {
      ...getMockAgreement(generateId<EServiceId>(), consumer.id),
      producerId: producer.id,
    };

    const pendingAgreement = {
      ...getMockAgreement(),
      state: agreementState.pending,
      consumerId: agreement.consumerId,
      producerId: agreement.producerId,
      eserviceId: agreement.eserviceId,
    };

    await addOneAgreement(agreement);
    await addOneAgreement(pendingAgreement);

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: randomUUID(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      agreementAlreadyExists(consumer.id, agreement.eserviceId)
    );
  });

  it("should throw a consumerWithNotValidEmail error when consumer has not a contact email", async () => {
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

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: randomUUID(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      consumerWithNotValidEmail(agreement.id, consumer.id)
    );
  });

  it("should throw an eServiceNotFound error when eservice not exists", async () => {
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
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

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: randomUUID(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));
  });

  it("should throw a notLatestEServiceDescriptor error when eservice doesn't have descriptors with DRAFT state", async () => {
    const producer = getMockTenant();
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
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

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: randomUUID(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(notLatestEServiceDescriptor(agreement.descriptorId));
  });

  it("should throw a notLatestEServiceDescriptor error when eservice has a valid descriptor with different ID from agreement", async () => {
    const producer = getMockTenant();
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
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

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: randomUUID(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
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
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const allowedStatus: DescriptorState[] = [
      descriptorState.published,
      descriptorState.suspended,
    ];
    const descriptor = {
      ...getMockDescriptor(),
      state: randomArrayItem(
        Object.values(descriptorState).filter(
          (state: DescriptorState) =>
            !allowedStatus.includes(state) && state !== descriptorState.draft
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

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: randomUUID(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(
      descriptorNotInExpectedState(eservice.id, descriptor.id, allowedStatus)
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
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
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

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: randomUUID(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(tenantNotFound(agreement.producerId));
  });

  it("should throw an agreementSubmissionFailed error when new agreement state is not ACTIVE or PENDING", async () => {
    const producer = getMockTenant();
    const consumer = {
      ...getMockTenant(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
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

    const authData = getRandomAuthData(consumer.id);

    mockSelfCareResponse();
    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: randomUUID(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(agreementSubmissionFailed(agreement.id));
  });

  it("should throw an userNotFound error when selfcare id is not found for current UserId in getSubmissionInfo", async () => {
    const consumer = {
      ...getMockTenant(),
      selfcareId: generateId<SelfcareId>(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };
    const producer = getMockTenant(consumer.id);

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
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

    const authData = getRandomAuthData(consumer.id);
    mockSelfCareResponse(undefined);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: randomUUID(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(userNotFound(consumer.selfcareId, authData.userId));
  });

  it("should throw an agreementSelfcareIdNotFound error when selfcare id is not found for current UserId", async () => {
    const consumer = {
      ...getMockTenant(),
      selfcareId: undefined,
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };
    const producer = getMockTenant(consumer.id);

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
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

    const authData = getRandomAuthData(consumer.id);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: randomUUID(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(agreementSelfcareIdNotFound(consumer.id));
  });

  it("should throw an agreementMissingUserInfo error when who property is missing", async () => {
    const consumer = {
      ...getMockTenant(),
      selfcareId: generateId<SelfcareId>(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };
    const producer = getMockTenant(consumer.id);

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
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

    const authData = getRandomAuthData(consumer.id);
    mockSelfCareResponse({});

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        { consumerNotes: "This is a test" },
        {
          authData,
          correlationId: randomUUID(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
      )
    ).rejects.toThrowError(agreementMissingUserInfo(authData.userId));
  });

  it("should throw an agreementSubmissionFailed error when recalulation of suspendByPlatform returns true", async () => {
    const consumerId = generateId<TenantId>();
    const producer = getMockTenant();
    const consumerNotesText = "This is a test";

    const validVerifiedTenantAttribute: TenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: consumerId,
          verificationDate: new Date(new Date().getFullYear() - 1),
          expirationDate: new Date(new Date().getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
    };

    const consumer = {
      ...getMockTenant(consumerId, [validVerifiedTenantAttribute]),
      selfcareId: generateId<SelfcareId>(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
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
      suspendedByConsumer: false,
      suspendedByProducer: false,
      suspendedByPlatform: false,
    };

    const attribute: Attribute = {
      id: validVerifiedTenantAttribute.id,
      kind: attributeKind.verified,
      description: "A verified attribute",
      name: "A verified attribute name",
      creationTime: new Date(new Date().getFullYear() - 1),
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAttribute(attribute);
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(consumer.id);
    const mockUserResponse: UserResponse = {
      email: "selfcare.test.submitagreement@test.org",
      name: "Test Name",
      surname: "Test Surname",
      id: generateId(),
      taxCode: "TAXCODE",
    };

    mockSelfCareResponse(mockUserResponse);

    await expect(
      agreementService.submitAgreement(
        agreement.id,
        {
          consumerNotes: consumerNotesText,
        },
        {
          authData,
          correlationId: randomUUID(),
          serviceName: "AgreementServiceTest",
          logger: genericLogger,
        }
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

    expect(selfcareV2ClientMock.getUserInfoUsingGET).not.toHaveBeenCalled();
    expect(actualAgreement.suspendedByPlatform).toBeTruthy();
    expect(actualAgreement.state).toEqual(
      toAgreementStateV2(agreementState.missingCertifiedAttributes)
    );
  });

  it("should submit agreement contract with state ACTIVE when producer is equal to consumer, generates AgreementActivated event and AgreementArchivedByUpgrade for related agreements", async () => {
    const producerAndConsumerId = generateId<TenantId>();
    const producer = getMockTenant(producerAndConsumerId);
    const consumerNotesText = "This is a test";

    const validVerifiedTenantAttribute: TenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producerAndConsumerId,
          verificationDate: new Date(new Date().getFullYear() - 1),
          expirationDate: new Date(new Date().getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
    };

    const consumer = {
      ...getMockTenant(producerAndConsumerId, [validVerifiedTenantAttribute]),
      selfcareId: generateId<SelfcareId>(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
      attributes: {
        certified: [],
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
      suspendedByConsumer: false,
      suspendedByProducer: false,
      suspendedByPlatform: false,
    };

    const attribute: Attribute = {
      id: validVerifiedTenantAttribute.id,
      kind: attributeKind.verified,
      description: "A verified attribute",
      name: "A verified attribute name",
      creationTime: new Date(new Date().getFullYear() - 1),
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAttribute(attribute);
    await addOneAgreement(agreement);

    const {
      archivableRelatedAgreement1,
      archivableRelatedAgreement2,
      nonArchivableRelatedAgreement,
    } = await addRelatedAgreements(agreement);

    const authData = getRandomAuthData(consumer.id);
    const mockUserResponse: UserResponse = {
      email: "selfcare.test.submitagreement@test.org",
      name: "Test Name",
      surname: "Test Surname",
      id: generateId(),
      taxCode: "TAXCODE",
    };

    mockSelfCareResponse(mockUserResponse);
    const submittedAgreement = await agreementService.submitAgreement(
      agreement.id,
      {
        consumerNotes: consumerNotesText,
      },
      {
        authData,
        correlationId: randomUUID(),
        serviceName: "AgreementServiceTest",
        logger: genericLogger,
      }
    );

    expect(submittedAgreement).toBeDefined();
    expect(submittedAgreement.state).toBe(agreementState.active);

    const uploadedFiles = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );

    expect(submittedAgreement.contract).toBeDefined();
    expect(uploadedFiles.length).toEqual(0);

    const actualAgreementData = await readLastAgreementEvent(agreement.id);
    if (!actualAgreementData) {
      fail("Creation fails: agreement not found in event-store");
    }

    expect(actualAgreementData.type).toEqual("AgreementActivated");
    expect(actualAgreementData).toMatchObject({
      type: "AgreementActivated",
      event_version: 2,
      version: "1",
      stream_id: submittedAgreement.id,
    });

    const actualAgreement: AgreementV2 | undefined = decodeProtobufPayload({
      messageType: AgreementActivatedV2,
      payload: actualAgreementData.data,
    }).agreement;

    if (!actualAgreement) {
      fail("impossible to decode AgreementAddedV1 data");
    }

    expect(selfcareV2ClientMock.getUserInfoUsingGET).not.toHaveBeenCalled();
    expect(actualAgreement).toMatchObject({
      id: submittedAgreement.id,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: producer.id,
      consumerId: consumer.id,
      state: toAgreementStateV2(agreementState.active),
      contract: {
        id: expect.any(String),
        name: expect.any(String),
        prettyName: expect.any(String),
        contentType: expect.any(String),
        path: expect.any(String),
        createdAt: expect.any(BigInt),
      },
      consumerNotes: consumerNotesText,
      verifiedAttributes: [
        {
          id: validVerifiedTenantAttribute.id,
        },
      ],
      suspendedByConsumer: false,
      suspendedByProducer: false,
      suspendedByPlatform: false,
    });
    expect(actualAgreement.stamps?.activation).toMatchObject({
      who: authData.userId,
      when: expect.any(BigInt),
    });

    await testRelatedAgreementsArchiviation({
      archivableRelatedAgreement1,
      archivableRelatedAgreement2,
      nonArchivableRelatedAgreement,
    });
  });

  it("should create a new agreement contract for first activation with new state ACTIVE when producer is equal to consumer, generates AgreementActivated event", async () => {
    const producerAndConsumerId = generateId<TenantId>();
    const producer = getMockTenant(producerAndConsumerId);
    const consumerNotesText = "This is a test";

    const validVerifiedTenantAttribute: TenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producerAndConsumerId,
          verificationDate: new Date(new Date().getFullYear() - 1),
          expirationDate: new Date(new Date().getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
    };

    const consumer = {
      ...getMockTenant(producerAndConsumerId, [validVerifiedTenantAttribute]),
      selfcareId: generateId<SelfcareId>(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
      attributes: {
        certified: [],
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
      suspendedByConsumer: false,
      suspendedByProducer: false,
      suspendedByPlatform: false,
    };

    const attribute: Attribute = {
      id: validVerifiedTenantAttribute.id,
      kind: attributeKind.verified,
      description: "A verified attribute",
      name: "A verified attribute name",
      creationTime: new Date(new Date().getFullYear() - 1),
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAttribute(attribute);
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(consumer.id);
    const mockUserResponse: UserResponse = {
      email: "selfcare.test.submitagreement@test.org",
      name: "Test Name",
      surname: "Test Surname",
      id: generateId(),
      taxCode: "TAXCODE",
    };

    mockSelfCareResponse(mockUserResponse);
    const submittedAgreement = await agreementService.submitAgreement(
      agreement.id,
      {
        consumerNotes: consumerNotesText,
      },
      {
        authData,
        correlationId: randomUUID(),
        serviceName: "AgreementServiceTest",
        logger: genericLogger,
      }
    );

    expect(submittedAgreement).toBeDefined();
    expect(submittedAgreement.state).toBe(agreementState.active);

    const uploadedFiles = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );

    expect(submittedAgreement.contract).toBeDefined();
    expect(uploadedFiles[0]).toEqual(submittedAgreement.contract?.path);

    const actualAgreementData = await readLastAgreementEvent(agreement.id);
    if (!actualAgreementData) {
      fail("Creation fails: agreement not found in event-store");
    }

    expect(actualAgreementData.type).toEqual("AgreementActivated");
    expect(actualAgreementData).toMatchObject({
      type: "AgreementActivated",
      event_version: 2,
      version: "1",
      stream_id: submittedAgreement.id,
    });

    const actualAgreement: AgreementV2 | undefined = decodeProtobufPayload({
      messageType: AgreementActivatedV2,
      payload: actualAgreementData.data,
    }).agreement;

    if (!actualAgreement) {
      fail("impossible to decode AgreementAddedV1 data");
    }

    expect(selfcareV2ClientMock.getUserInfoUsingGET).toHaveBeenCalled();
    expect(actualAgreement).toMatchObject({
      id: submittedAgreement.id,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: producer.id,
      consumerId: consumer.id,
      state: toAgreementStateV2(agreementState.active),
      contract: {
        id: expect.any(String),
        name: expect.any(String),
        prettyName: expect.any(String),
        contentType: expect.any(String),
        path: expect.any(String),
        createdAt: expect.any(BigInt),
      },
      consumerNotes: consumerNotesText,
      verifiedAttributes: [
        {
          id: validVerifiedTenantAttribute.id,
        },
      ],
      suspendedByConsumer: false,
      suspendedByProducer: false,
      suspendedByPlatform: false,
    });
    expect(actualAgreement.stamps?.activation).toMatchObject({
      who: authData.userId,
      when: expect.any(BigInt),
    });
  });

  it("should submit agreement contract with new state ACTIVE when producer and consumer are differents, generates AgreementActivated event and AgreementArchivedByUpgrade for related agreements", async () => {
    const consumerId = generateId<TenantId>();
    const producer = getMockTenant(consumerId);
    const consumerNotesText = "This is a test";

    const validVerifiedTenantAttribute: TenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: consumerId,
          verificationDate: new Date(new Date().getFullYear() - 1),
          expirationDate: new Date(new Date().getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
    };

    const consumer = {
      ...getMockTenant(consumerId, [validVerifiedTenantAttribute]),
      selfcareId: generateId<SelfcareId>(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
      attributes: {
        certified: [],
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
      suspendedByConsumer: false,
      suspendedByProducer: false,
      suspendedByPlatform: false,
    };

    const attribute: Attribute = {
      id: validVerifiedTenantAttribute.id,
      kind: attributeKind.verified,
      description: "A verified attribute",
      name: "A verified attribute name",
      creationTime: new Date(new Date().getFullYear() - 1),
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAttribute(attribute);
    await addOneAgreement(agreement);

    const {
      archivableRelatedAgreement1,
      archivableRelatedAgreement2,
      nonArchivableRelatedAgreement,
    } = await addRelatedAgreements(agreement);

    const authData = getRandomAuthData(consumer.id);
    const mockUserResponse: UserResponse = {
      email: "selfcare.test.submitagreement@test.org",
      name: "Test Name",
      surname: "Test Surname",
      id: generateId(),
      taxCode: "TAXCODE",
    };

    mockSelfCareResponse(mockUserResponse);
    const submittedAgreement = await agreementService.submitAgreement(
      agreement.id,
      {
        consumerNotes: consumerNotesText,
      },
      {
        authData,
        correlationId: randomUUID(),
        serviceName: "AgreementServiceTest",
        logger: genericLogger,
      }
    );

    expect(submittedAgreement).toBeDefined();
    expect(submittedAgreement.state).toBe(agreementState.active);

    const uploadedFiles = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );

    expect(submittedAgreement.contract).toBeDefined();
    expect(uploadedFiles.length).toEqual(0);

    const actualAgreementData = await readLastAgreementEvent(agreement.id);
    if (!actualAgreementData) {
      fail("Creation fails: agreement not found in event-store");
    }

    expect(actualAgreementData.type).toEqual("AgreementActivated");
    expect(actualAgreementData).toMatchObject({
      type: "AgreementActivated",
      event_version: 2,
      version: "1",
      stream_id: submittedAgreement.id,
    });

    const actualAgreement: AgreementV2 | undefined = decodeProtobufPayload({
      messageType: AgreementActivatedV2,
      payload: actualAgreementData.data,
    }).agreement;

    if (!actualAgreement) {
      fail("impossible to decode AgreementAddedV1 data");
    }

    expect(selfcareV2ClientMock.getUserInfoUsingGET).not.toHaveBeenCalled();
    expect(actualAgreement).toMatchObject({
      id: submittedAgreement.id,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: producer.id,
      consumerId: consumer.id,
      state: toAgreementStateV2(agreementState.active),
      contract: {
        id: expect.any(String),
        name: expect.any(String),
        prettyName: expect.any(String),
        contentType: expect.any(String),
        path: expect.any(String),
        createdAt: expect.any(BigInt),
      },
      consumerNotes: consumerNotesText,
      verifiedAttributes: [
        {
          id: validVerifiedTenantAttribute.id,
        },
      ],
      suspendedByConsumer: false,
      suspendedByProducer: false,
      suspendedByPlatform: false,
    });
    expect(actualAgreement.stamps?.activation).toMatchObject({
      who: authData.userId,
      when: expect.any(BigInt),
    });

    await testRelatedAgreementsArchiviation({
      archivableRelatedAgreement1,
      archivableRelatedAgreement2,
      nonArchivableRelatedAgreement,
    });
  });

  it("should create a new agreement contract for first activation with new state ACTIVE when producer and consumer are different, generates AgreementActivated", async () => {
    const consumerId = generateId<TenantId>();
    const producer = getMockTenant(consumerId);
    const consumerNotesText = "This is a test";

    const validVerifiedTenantAttribute: TenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: consumerId,
          verificationDate: new Date(new Date().getFullYear() - 1),
          expirationDate: new Date(new Date().getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
    };

    const consumer = {
      ...getMockTenant(consumerId, [validVerifiedTenantAttribute]),
      selfcareId: generateId<SelfcareId>(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
      attributes: {
        certified: [],
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
      suspendedByConsumer: false,
      suspendedByProducer: false,
      suspendedByPlatform: false,
    };

    const attribute: Attribute = {
      id: validVerifiedTenantAttribute.id,
      kind: attributeKind.verified,
      description: "A verified attribute",
      name: "A verified attribute name",
      creationTime: new Date(new Date().getFullYear() - 1),
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAttribute(attribute);
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(consumer.id);
    const mockUserResponse: UserResponse = {
      email: "selfcare.test.submitagreement@test.org",
      name: "Test Name",
      surname: "Test Surname",
      id: generateId(),
      taxCode: "TAXCODE",
    };

    mockSelfCareResponse(mockUserResponse);
    const submittedAgreement = await agreementService.submitAgreement(
      agreement.id,
      {
        consumerNotes: consumerNotesText,
      },
      {
        authData,
        correlationId: randomUUID(),
        serviceName: "AgreementServiceTest",
        logger: genericLogger,
      }
    );

    expect(submittedAgreement).toBeDefined();
    expect(submittedAgreement.state).toBe(agreementState.active);

    const uploadedFiles = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );

    expect(submittedAgreement.contract).toBeDefined();
    expect(uploadedFiles[0]).toEqual(submittedAgreement.contract?.path);

    const actualAgreementData = await readLastAgreementEvent(agreement.id);
    if (!actualAgreementData) {
      fail("Creation fails: agreement not found in event-store");
    }

    expect(actualAgreementData.type).toEqual("AgreementActivated");
    expect(actualAgreementData).toMatchObject({
      type: "AgreementActivated",
      event_version: 2,
      version: "1",
      stream_id: submittedAgreement.id,
    });

    const actualAgreement: AgreementV2 | undefined = decodeProtobufPayload({
      messageType: AgreementActivatedV2,
      payload: actualAgreementData.data,
    }).agreement;

    if (!actualAgreement) {
      fail("impossible to decode AgreementAddedV1 data");
    }

    expect(selfcareV2ClientMock.getUserInfoUsingGET).toHaveBeenCalled();
    expect(actualAgreement).toMatchObject({
      id: submittedAgreement.id,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: producer.id,
      consumerId: consumer.id,
      state: toAgreementStateV2(agreementState.active),
      contract: {
        id: expect.any(String),
        name: expect.any(String),
        prettyName: expect.any(String),
        contentType: expect.any(String),
        path: expect.any(String),
        createdAt: expect.any(BigInt),
      },
      consumerNotes: consumerNotesText,
      verifiedAttributes: [
        {
          id: validVerifiedTenantAttribute.id,
        },
      ],
      suspendedByConsumer: false,
      suspendedByProducer: false,
      suspendedByPlatform: false,
    });
    expect(actualAgreement.stamps?.activation).toMatchObject({
      who: authData.userId,
      when: expect.any(BigInt),
    });
  });

  it("should submit agreement with new state PENDING when producer is different from consumer and no related agreements exist, generates AgreementSubmitted event", async () => {
    const consumerId = generateId<TenantId>();
    const producer = getMockTenant();
    const consumerNotesText = "This is a test";

    const validVerifiedTenantAttribute: TenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: consumerId,
          verificationDate: new Date(new Date().getFullYear() - 1),
          expirationDate: new Date(new Date().getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
    };

    const certifiedTenantAttribute: TenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const declareTenantAttributeMissingInDescriptor: TenantAttribute =
      getMockCertifiedTenantAttribute();

    const consumer = {
      ...getMockTenant(consumerId, [
        validVerifiedTenantAttribute,
        certifiedTenantAttribute,
        declareTenantAttributeMissingInDescriptor,
      ]),
      selfcareId: generateId<SelfcareId>(),
      mails: [
        {
          id: generateId(),
          kind: tenantMailKind.ContactEmail,
          address: "avalidemailaddressfortenant@testingagreement.com",
          createdAt: new Date(),
        },
      ],
    };

    const verifiedDescriptorAttribute = getMockEServiceAttribute(
      validVerifiedTenantAttribute.id
    );
    const certifiedDescriptorAttribute = getMockEServiceAttribute(
      certifiedTenantAttribute.id
    );

    const descriptor = {
      ...getMockDescriptor(),
      state: descriptorState.suspended,
      agreementApprovalPolicy: agreementApprovalPolicy.manual,
      attributes: {
        certified: [[certifiedDescriptorAttribute]],
        declared: [],
        verified: [[verifiedDescriptorAttribute]],
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
      suspendedByConsumer: false,
      suspendedByProducer: false,
      suspendedByPlatform: false,
    };

    const attribute: Attribute = {
      id: validVerifiedTenantAttribute.id,
      kind: attributeKind.verified,
      description: "A verified attribute",
      name: "A verified attribute name",
      creationTime: new Date(new Date().getFullYear() - 1),
    };

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneAttribute(attribute);
    await addOneAgreement(agreement);

    const authData = getRandomAuthData(consumer.id);
    const mockUserResponse: UserResponse = {
      email: "selfcare.test.submitagreement@test.org",
      name: "Test Name",
      surname: "Test Surname",
      id: generateId(),
      taxCode: "TAXCODE",
    };

    mockSelfCareResponse(mockUserResponse);
    const submittedAgreement = await agreementService.submitAgreement(
      agreement.id,
      {
        consumerNotes: consumerNotesText,
      },
      {
        authData,
        correlationId: randomUUID(),
        serviceName: "AgreementServiceTest",
        logger: genericLogger,
      }
    );

    expect(submittedAgreement).toBeDefined();
    expect(submittedAgreement.state).toBe(agreementState.pending);

    const uploadedFiles = await fileManager.listFiles(
      config.s3Bucket,
      genericLogger
    );

    expect(submittedAgreement.contract).toBeDefined();
    expect(uploadedFiles.length).toEqual(0);

    const actualAgreementData = await readLastAgreementEvent(agreement.id);
    if (!actualAgreementData) {
      fail("Creation fails: agreement not found in event-store");
    }

    expect(actualAgreementData.type).toEqual("AgreementSubmitted");
    expect(actualAgreementData).toMatchObject({
      type: "AgreementSubmitted",
      event_version: 2,
      version: "1",
      stream_id: submittedAgreement.id,
    });

    const actualAgreement: AgreementV2 | undefined = decodeProtobufPayload({
      messageType: AgreementSubmittedV2,
      payload: actualAgreementData.data,
    }).agreement;

    if (!actualAgreement) {
      fail("impossible to decode AgreementActivatedV2 data");
    }

    expect(selfcareV2ClientMock.getUserInfoUsingGET).not.toHaveBeenCalled();
    expect(actualAgreement.suspendedByConsumer).toBeUndefined();
    expect(actualAgreement.suspendedByProducer).toBeUndefined();
    expect(actualAgreement.suspendedByPlatform).toBeFalsy();
    expect(actualAgreement).toMatchObject({
      id: submittedAgreement.id,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: producer.id,
      consumerId: consumer.id,
      state: toAgreementStateV2(agreementState.pending),
      contract: {
        id: expect.any(String),
        name: expect.any(String),
        prettyName: expect.any(String),
        contentType: expect.any(String),
        path: expect.any(String),
        createdAt: expect.any(BigInt),
      },
      consumerNotes: consumerNotesText,
      certifiedAttributes: [],
      declaredAttributes: [],
      verifiedAttributes: [],
    });

    expect(actualAgreement.stamps?.submission).toMatchObject({
      who: authData.userId,
      when: expect.any(BigInt),
    });
  });
});
