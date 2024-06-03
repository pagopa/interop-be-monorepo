/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockAgreementAttribute,
  getMockAttribute,
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
  getMockDescriptorPublished,
  getMockEService,
  getMockEServiceAttribute,
  getMockTenant,
  getMockVerifiedTenantAttribute,
  getRandomAuthData,
  randomArrayItem,
  randomBoolean,
} from "pagopa-interop-commons-test";
import {
  formatDateyyyyMMddHHmmss,
  genericLogger,
} from "pagopa-interop-commons";
import {
  generateId,
  AgreementId,
  agreementState,
  EService,
  Agreement,
  Descriptor,
  descriptorState,
  TenantId,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  VerifiedTenantAttribute,
  Tenant,
  TenantAttribute,
  fromAgreementV2,
  AgreementUnsuspendedByProducerV2,
  AgreementUnsuspendedByConsumerV2,
  Attribute,
  AgreementActivatedV2,
  UserId,
  pdfGenerationError,
  AgreementSetMissingCertifiedAttributesByPlatformV2,
  AgreementUnsuspendedByPlatformV2,
} from "pagopa-interop-models";
import { UserResponse } from "pagopa-interop-selfcare-v2-client";
import {
  agreementActivationFailed,
  agreementMissingUserInfo,
  agreementNotFound,
  agreementNotInExpectedState,
  agreementStampNotFound,
  attributeNotFound,
  descriptorNotFound,
  descriptorNotInExpectedState,
  eServiceNotFound,
  operationNotAllowed,
  tenantNotFound,
  userNotFound,
} from "../src/model/domain/errors.js";
import {
  agreementActivableStates,
  agreementActivationAllowedDescriptorStates,
  agreementArchivableStates,
} from "../src/model/domain/validators.js";
import { config } from "../src/utilities/config.js";
import {
  addOneAgreement,
  addOneAttribute,
  addOneEService,
  addOneTenant,
  agreementService,
  closeTestBrowserInstance,
  fileManager,
  readAgreementEventByVersion,
  readLastAgreementEvent,
  respawnTestBrowserInstance,
  selfcareV2ClientMock,
} from "./utils.js";

describe("activate agreement", () => {
  // TODO Add case where the agreement is suspended by platform even if it was suspended only by consumer or producer

  // TODO also test manually

  const mockSelfcareUserResponse: UserResponse = {
    email: "test@test.com",
    name: "Test Name",
    surname: "Test Surname",
    id: generateId(),
    taxCode: "TSTTSTTSTTSTTSTT",
  };

  const mockSelfcareUserResponseWithMissingInfo: UserResponse = {
    ...mockSelfcareUserResponse,
    name: randomArrayItem([mockSelfcareUserResponse.name, undefined]),
    surname: randomArrayItem([mockSelfcareUserResponse.surname, undefined]),
    taxCode: randomArrayItem([mockSelfcareUserResponse.taxCode, undefined]),
  };

  beforeEach(async () => {
    selfcareV2ClientMock.getUserInfoUsingGET = vi.fn(
      async () => mockSelfcareUserResponse
    );
  });

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
      state: randomArrayItem(agreementArchivableStates),
    };

    const archivableRelatedAgreement2: Agreement = {
      ...getMockAgreement(),
      consumerId: agreement.consumerId,
      eserviceId: agreement.eserviceId,
      state: randomArrayItem(agreementArchivableStates),
    };

    const nonArchivableRelatedAgreement: Agreement = {
      ...getMockAgreement(),
      consumerId: agreement.consumerId,
      eserviceId: agreement.eserviceId,
      state: randomArrayItem(
        Object.values(agreementState).filter(
          (state) => !agreementArchivableStates.includes(state)
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

  it("should activate a Pending Agreement when the requester is the Producer and all attributes are valid", async () => {
    const producer = getMockTenant();

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

    const validTenantCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(certifiedAttribute.id),
      revocationTimestamp: undefined,
    };

    const validTenantDeclaredAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(declaredAttribute.id),
      revocationTimestamp: undefined,
    };

    const validTenantVerifiedAttribute: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
      verifiedBy: [
        {
          id: producer.id,
          verificationDate: new Date(),
          extensionDate: new Date(new Date().getTime() + 3600 * 1000),
        },
      ],
    };

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        validTenantCertifiedAttribute,
        validTenantDeclaredAttribute,
        validTenantVerifiedAttribute,
      ],
    };

    const authData = getRandomAuthData(producer.id);
    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: randomArrayItem(agreementActivationAllowedDescriptorStates),
      attributes: {
        certified: [
          [getMockEServiceAttribute(validTenantCertifiedAttribute.id)],
        ],
        declared: [[getMockEServiceAttribute(validTenantDeclaredAttribute.id)]],
        verified: [[getMockEServiceAttribute(validTenantVerifiedAttribute.id)]],
      },
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      descriptors: [descriptor],
    };

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.pending,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: producer.id,
      consumerId: consumer.id,
      suspendedByConsumer: false, // Must be false, otherwise the agreement would be suspended
      suspendedByProducer: randomBoolean(), // will be set to false by the activation
      stamps: {
        submission: {
          who: authData.userId,
          when: new Date(),
        },
        activation: undefined,
      },

      // Adding some random attributes to check that they are overwritten by the activation
      certifiedAttributes: [getMockAgreementAttribute()],
      declaredAttributes: [getMockAgreementAttribute()],
      verifiedAttributes: [getMockAgreementAttribute()],
    };

    await addOneAgreement(agreement);
    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneEService(eservice);
    await addOneAttribute(certifiedAttribute);
    await addOneAttribute(declaredAttribute);
    await addOneAttribute(verifiedAttribute);
    const relatedAgreements = await addRelatedAgreements(agreement);

    const acrivateAgreementReturnValue =
      await agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      });

    const agreementEvent = await readLastAgreementEvent(agreement.id);

    expect(agreementEvent).toMatchObject({
      type: "AgreementActivated",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const actualAgreementActivated = fromAgreementV2(
      decodeProtobufPayload({
        messageType: AgreementActivatedV2,
        payload: agreementEvent.data,
      }).agreement!
    );

    const contractDocumentId = actualAgreementActivated.contract!.id;
    const contractCreatedAt = actualAgreementActivated.contract!.createdAt;
    const contractDocumentName = `${consumer.id}_${
      producer.id
    }_${formatDateyyyyMMddHHmmss(contractCreatedAt)}_agreement_contract.pdf`;

    const expectedContract = {
      id: contractDocumentId,
      contentType: "application/pdf",
      createdAt: contractCreatedAt,
      path: `${config.agreementContractsPath}/${agreement.id}/${contractDocumentId}/${contractDocumentName}`,
      prettyName: "Richiesta di fruizione",
      name: contractDocumentName,
    };

    const expectedActivatedAgreement: Agreement = {
      ...agreement,
      state: agreementState.active,
      stamps: {
        ...agreement.stamps,
        activation: {
          who: authData.userId,
          when: actualAgreementActivated.stamps.activation!.when,
        },
      },
      certifiedAttributes: [{ id: certifiedAttribute.id }],
      declaredAttributes: [{ id: declaredAttribute.id }],
      verifiedAttributes: [{ id: verifiedAttribute.id }],
      contract: expectedContract,
      suspendedByProducer: false,
      suspendedByConsumer: false,
      suspendedByPlatform: false, // when the agreement is Activated this is uptated to false
    };

    expect(actualAgreementActivated).toMatchObject(expectedActivatedAgreement);

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContain(expectedContract.path);

    await testRelatedAgreementsArchiviation(relatedAgreements);
    expect(acrivateAgreementReturnValue).toMatchObject(
      expectedActivatedAgreement
    );
  });

  it("should activate a Suspended Agreement when the requester is the Consumer or the Producer, and all attributes are valid", async () => {
    const producer = getMockTenant();

    const validTenantCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const validTenantDeclaredAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const validTenantVerifiedAttribute: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producer.id,
          verificationDate: new Date(),
          extensionDate: new Date(new Date().getTime() + 3600 * 1000),
        },
      ],
    };

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        validTenantCertifiedAttribute,
        validTenantDeclaredAttribute,
        validTenantVerifiedAttribute,
      ],
    };

    const authData = getRandomAuthData(
      randomArrayItem([producer.id, consumer.id])
    );
    const isProducer = authData.organizationId === producer.id;

    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: randomArrayItem(agreementActivationAllowedDescriptorStates),
      attributes: {
        certified: [
          [getMockEServiceAttribute(validTenantCertifiedAttribute.id)],
        ],
        declared: [[getMockEServiceAttribute(validTenantDeclaredAttribute.id)]],
        verified: [[getMockEServiceAttribute(validTenantVerifiedAttribute.id)]],
      },
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      descriptors: [descriptor],
    };

    // Only one of the two flags is true, so that the next state is active
    const suspendedByProducer = isProducer;
    const suspendedByConsumer = !isProducer;
    const mockAgreement = getMockAgreement();
    const agreement: Agreement = {
      ...mockAgreement,
      state: agreementState.suspended,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: producer.id,
      consumerId: consumer.id,
      suspendedByProducer,
      suspendedByConsumer,
      suspendedAt: new Date(),
      stamps: {
        ...mockAgreement.stamps,
        suspensionByProducer: suspendedByProducer
          ? {
              who: authData.userId,
              when: new Date(),
            }
          : undefined,
        suspensionByConsumer: suspendedByConsumer
          ? {
              who: authData.userId,
              when: new Date(),
            }
          : undefined,
      },

      // Adding some random attributes to check that they are not modified by the Unsuspension
      certifiedAttributes: [getMockAgreementAttribute()],
      declaredAttributes: [getMockAgreementAttribute()],
      verifiedAttributes: [getMockAgreementAttribute()],
    };

    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    const relatedAgreements = await addRelatedAgreements(agreement);

    const activateAgreementReturnValue =
      await agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      });

    const agreementEvent = await readLastAgreementEvent(agreement.id);

    expect(agreementEvent).toMatchObject({
      type: isProducer
        ? "AgreementUnsuspendedByProducer"
        : "AgreementUnsuspendedByConsumer",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const actualAgreementActivated = fromAgreementV2(
      decodeProtobufPayload({
        messageType: isProducer
          ? AgreementUnsuspendedByProducerV2
          : AgreementUnsuspendedByConsumerV2,
        payload: agreementEvent.data,
      }).agreement!
    );

    const expectedActivatedAgreement: Agreement = {
      ...agreement,
      state: agreementState.active,
      suspendedAt: undefined,
      stamps: {
        ...agreement.stamps,
        suspensionByProducer: undefined,
        suspensionByConsumer: undefined,
      },
      suspendedByConsumer: false,
      suspendedByProducer: false,
      suspendedByPlatform: false, // when the agreement is Activated this is uptated to false
    };

    expect(actualAgreementActivated).toMatchObject(expectedActivatedAgreement);

    expect(activateAgreementReturnValue).toMatchObject(
      expectedActivatedAgreement
    );

    await testRelatedAgreementsArchiviation(relatedAgreements);
  });

  it("should activate a Suspended Agreement when the requester is the Consumer and the Producer, even on invalid attributes", async () => {
    const revokedTenantCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: new Date(),
    };

    const consumerAndProducer: Tenant = {
      ...getMockTenant(),
      attributes: [
        revokedTenantCertifiedAttribute,
        getMockDeclaredTenantAttribute(),
        getMockVerifiedTenantAttribute(),
      ],
    };

    const authData = getRandomAuthData(consumerAndProducer.id);

    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: randomArrayItem(agreementActivationAllowedDescriptorStates),
      attributes: {
        certified: [
          [getMockEServiceAttribute(consumerAndProducer.attributes[0].id)],
        ],
        declared: [
          [getMockEServiceAttribute(consumerAndProducer.attributes[1].id)],
        ],
        verified: [
          [getMockEServiceAttribute(consumerAndProducer.attributes[2].id)],
        ],
      },
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId: consumerAndProducer.id,
      descriptors: [descriptor],
    };

    // At least one of the two is true, they will both become false anyways
    const suspendedByConsumer = randomBoolean();
    const suspendedByProducer = !suspendedByConsumer ? true : randomBoolean();

    const mockAgreement = getMockAgreement();
    const agreement: Agreement = {
      ...mockAgreement,
      state: agreementState.suspended,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: consumerAndProducer.id,
      consumerId: consumerAndProducer.id,
      suspendedByProducer,
      suspendedByConsumer,
      suspendedAt: new Date(),
      stamps: {
        ...mockAgreement.stamps,
        suspensionByProducer: suspendedByProducer
          ? {
              who: authData.userId,
              when: new Date(),
            }
          : undefined,
        suspensionByConsumer: suspendedByConsumer
          ? {
              who: authData.userId,
              when: new Date(),
            }
          : undefined,
      },

      // Adding some random attributes to check that they are not modified by the Unsuspension
      certifiedAttributes: [getMockAgreementAttribute()],
      declaredAttributes: [getMockAgreementAttribute()],
      verifiedAttributes: [getMockAgreementAttribute()],
    };

    await addOneTenant(consumerAndProducer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    const relatedAgreements = await addRelatedAgreements(agreement);

    const activateAgreementReturnValue =
      await agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      });

    const agreementEvent = await readLastAgreementEvent(agreement.id);

    // In this case, where the caller is both Producer and Consumer,
    // it saves an UnsuspendedByProducer event
    expect(agreementEvent).toMatchObject({
      type: "AgreementUnsuspendedByProducer",
      event_version: 2,
      version: "1",
      stream_id: agreement.id,
    });

    const actualAgreementActivated = fromAgreementV2(
      decodeProtobufPayload({
        messageType: AgreementUnsuspendedByProducerV2,
        payload: agreementEvent.data,
      }).agreement!
    );

    const expectedActivatedAgreement: Agreement = {
      ...agreement,
      state: agreementState.active,
      suspendedAt: undefined,
      stamps: {
        ...agreement.stamps,
        suspensionByProducer: undefined,
        suspensionByConsumer: undefined,
      },
      suspendedByConsumer: false,
      suspendedByProducer: false,
      suspendedByPlatform: false, // when the agreement is Activated this is uptated to false
    };

    expect(actualAgreementActivated).toMatchObject(expectedActivatedAgreement);

    expect(activateAgreementReturnValue).toMatchObject(
      expectedActivatedAgreement
    );

    await testRelatedAgreementsArchiviation(relatedAgreements);
  });

  describe("a Suspended Agreement with valid attributes that was suspended both by Producer and Consumer", () => {
    const producer = getMockTenant();

    const validTenantCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const validTenantDeclaredAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const validTenantVerifiedAttribute: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producer.id,
          verificationDate: new Date(),
          extensionDate: new Date(new Date().getTime() + 3600 * 1000),
        },
      ],
    };

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        validTenantCertifiedAttribute,
        validTenantDeclaredAttribute,
        validTenantVerifiedAttribute,
      ],
    };

    const authData = getRandomAuthData(
      randomArrayItem([producer.id, consumer.id])
    );
    const isProducer = authData.organizationId === producer.id;

    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: randomArrayItem(agreementActivationAllowedDescriptorStates),
      attributes: {
        certified: [
          [getMockEServiceAttribute(validTenantCertifiedAttribute.id)],
        ],
        declared: [[getMockEServiceAttribute(validTenantDeclaredAttribute.id)]],
        verified: [[getMockEServiceAttribute(validTenantVerifiedAttribute.id)]],
      },
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      descriptors: [descriptor],
    };

    const mockAgreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.suspended,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: producer.id,
      consumerId: consumer.id,
      suspendedByProducer: true,
      suspendedByConsumer: true,
      suspendedAt: new Date(),
      stamps: {
        ...getMockAgreement().stamps,
        suspensionByProducer: {
          who: authData.userId,
          when: new Date(),
        },
        suspensionByConsumer: {
          who: authData.userId,
          when: new Date(),
        },
      },
      // Adding some random attributes to check that they are not modified by the Unsuspension
      certifiedAttributes: [getMockAgreementAttribute()],
      declaredAttributes: [getMockAgreementAttribute()],
      verifiedAttributes: [getMockAgreementAttribute()],
    };

    const expectedStamps = {
      suspensionByProducer: isProducer
        ? undefined
        : mockAgreement.stamps.suspensionByProducer,
      suspensionByConsumer: !isProducer
        ? undefined
        : mockAgreement.stamps.suspensionByConsumer,
    };

    const expectedUnsuspendedAgreement: Agreement = {
      ...mockAgreement,
      state: agreementState.suspended,
      suspendedAt: mockAgreement.suspendedAt,
      stamps: {
        ...mockAgreement.stamps,
        ...expectedStamps,
      },
      suspendedByConsumer: isProducer ? true : false,
      suspendedByProducer: !isProducer ? true : false,
    };

    it("if suspendedByPlatform === false, it should be unsuspended by Producer or Consumer and remain in a Suspended state", async () => {
      const agreement: Agreement = {
        ...mockAgreement,
        suspendedByPlatform: false,
      };
      const expected = {
        ...expectedUnsuspendedAgreement,
        suspendedByPlatform: false,
      };
      await addOneTenant(consumer);
      await addOneTenant(producer);
      await addOneEService(eservice);
      await addOneAgreement(agreement);
      const relatedAgreements = await addRelatedAgreements(agreement);

      const activateAgreementReturnValue =
        await agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: "",
          logger: genericLogger,
        });

      const agreementEvent = await readLastAgreementEvent(agreement.id);

      expect(agreementEvent).toMatchObject({
        type: isProducer
          ? "AgreementUnsuspendedByProducer"
          : "AgreementUnsuspendedByConsumer",
        event_version: 2,
        version: "1",
        stream_id: agreement.id,
      });

      const actualAgreementUnsuspended = fromAgreementV2(
        decodeProtobufPayload({
          messageType: isProducer
            ? AgreementUnsuspendedByProducerV2
            : AgreementUnsuspendedByConsumerV2,
          payload: agreementEvent.data,
        }).agreement!
      );

      await testRelatedAgreementsArchiviation(relatedAgreements);

      expect(actualAgreementUnsuspended).toMatchObject(expected);

      expect(activateAgreementReturnValue).toMatchObject(expected);
    });

    it("if suspendedByPlatform === true, it should be unsuspended by Producer or Consumer and also by platform, and remain in a Suspended state", async () => {
      const agreement: Agreement = {
        ...mockAgreement,
        suspendedByPlatform: true,
      };

      const expected1 = {
        ...expectedUnsuspendedAgreement,
        suspendedByPlatform: true,
      };

      const expected2 = {
        ...expected1,
        suspendedByPlatform: false,
      };

      await addOneTenant(consumer);
      await addOneTenant(producer);
      await addOneEService(eservice);
      await addOneAgreement(agreement);
      const relatedAgreements = await addRelatedAgreements(agreement);

      const activateAgreementReturnValue =
        await agreementService.activateAgreement(agreement.id, {
          authData,
          serviceName: "",
          correlationId: "",
          logger: genericLogger,
        });

      const agreementEvent = await readAgreementEventByVersion(agreement.id, 1);

      expect(agreementEvent).toMatchObject({
        type: isProducer
          ? "AgreementUnsuspendedByProducer"
          : "AgreementUnsuspendedByConsumer",
        event_version: 2,
        version: "1",
        stream_id: agreement.id,
      });

      const actualAgreementUnsuspended = fromAgreementV2(
        decodeProtobufPayload({
          messageType: isProducer
            ? AgreementUnsuspendedByProducerV2
            : AgreementUnsuspendedByConsumerV2,
          payload: agreementEvent.data,
        }).agreement!
      );

      expect(actualAgreementUnsuspended).toMatchObject(expected1);

      const agreementUnsuspendedByPlatformEvent =
        await readAgreementEventByVersion(agreement.id, 2);

      expect(agreementUnsuspendedByPlatformEvent).toMatchObject({
        type: "AgreementUnsuspendedByPlatform",
        event_version: 2,
        version: "2",
        stream_id: agreement.id,
      });

      const actualAgreementUnsuspendedByPlatform = fromAgreementV2(
        decodeProtobufPayload({
          messageType: AgreementUnsuspendedByPlatformV2,
          payload: agreementUnsuspendedByPlatformEvent.data,
        }).agreement!
      );

      await testRelatedAgreementsArchiviation(relatedAgreements);
      expect(actualAgreementUnsuspendedByPlatform).toMatchObject(expected2);
      expect(activateAgreementReturnValue).toMatchObject(expected2);
    });
  });

  it("should throw an agreementNotFound error when the Agreement does not exist", async () => {
    await addOneAgreement(getMockAgreement());
    const authData = getRandomAuthData();
    const agreementId = generateId<AgreementId>();
    await expect(
      agreementService.activateAgreement(agreementId, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });

  it("should throw an operationNotAllowed error when the requester is not the Consumer or Producer", async () => {
    const authData = getRandomAuthData();
    const agreement: Agreement = getMockAgreement();
    await addOneAgreement(agreement);
    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should throw an operationNotAllowed error when the requester is the Consumer and the Agreement is Pending", async () => {
    const consumerId = generateId<TenantId>();
    const authData = getRandomAuthData(consumerId);

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.pending,
      consumerId,
    };
    await addOneAgreement(agreement);
    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should NOT throw an operationNotAllowed error when the requester is the Producer and the Agreement is Pending", async () => {
    const producerId = generateId<TenantId>();
    const authData = getRandomAuthData(producerId);

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.pending,
      producerId,
    };
    await addOneAgreement(agreement);
    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.not.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should throw an agreementNotInExpectedState error when the Agreement is not in an activable state", async () => {
    const consumerId = generateId<TenantId>();
    const authData = getRandomAuthData(consumerId);

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(
        Object.values(agreementState).filter(
          (state) => !agreementActivableStates.includes(state)
        )
      ),
      consumerId,
    };
    await addOneAgreement(agreement);
    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement.id, agreement.state)
    );
  });

  it("should throw an eServiceNotFound error when the EService does not exist", async () => {
    const consumerId = generateId<TenantId>();
    const authData = getRandomAuthData(consumerId);

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(
        agreementActivableStates.filter((s) => s !== agreementState.pending)
      ),
      consumerId,
    };
    await addOneAgreement(agreement);
    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));
  });

  it("should throw a descriptorNotFound error when the Descriptor does not exist", async () => {
    const consumerId = generateId<TenantId>();
    const producerId = generateId<TenantId>();
    const authData = getRandomAuthData(producerId);

    const eservice: EService = {
      ...getMockEService(),
      producerId,
    };
    const agreement: Agreement = {
      ...getMockAgreement(),
      eserviceId: eservice.id,
      consumerId,
      state: randomArrayItem(agreementActivableStates),
      producerId,
    };

    await addOneEService(eservice);
    await addOneAgreement(agreement);

    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      descriptorNotFound(agreement.eserviceId, agreement.descriptorId)
    );
  });

  it("should throw a descriptorNotInExpectedState error when the Descriptor is not in an expected state", async () => {
    const consumerId = generateId<TenantId>();
    const producerId = generateId<TenantId>();
    const authData = getRandomAuthData(producerId);

    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: randomArrayItem(
        Object.values(descriptorState).filter(
          (state) => !agreementActivationAllowedDescriptorStates.includes(state)
        )
      ),
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId,
      descriptors: [descriptor],
    };

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementActivableStates),
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId,
      consumerId,
    };

    await addOneEService(eservice);
    await addOneAgreement(agreement);

    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      descriptorNotInExpectedState(
        eservice.id,
        descriptor.id,
        agreementActivationAllowedDescriptorStates
      )
    );
  });

  it("should throw a tenantNotFound error when the Consumer does not exist", async () => {
    const consumerId = generateId<TenantId>();
    const producerId = generateId<TenantId>();
    const authData = getRandomAuthData(producerId);

    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: randomArrayItem(agreementActivationAllowedDescriptorStates),
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId,
      descriptors: [descriptor],
    };

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementActivableStates),
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId,
      consumerId,
    };

    await addOneEService(eservice);
    await addOneAgreement(agreement);

    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantNotFound(consumerId));
  });

  it("should throw a tenantNotFound error when the Producer does not exist", async () => {
    const producerId = generateId<TenantId>();
    const consumer = getMockTenant();
    const authData = getRandomAuthData(producerId);

    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: randomArrayItem(agreementActivationAllowedDescriptorStates),
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId,
      descriptors: [descriptor],
    };

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementActivableStates),
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId,
      consumerId: consumer.id,
    };

    await addOneTenant(consumer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);

    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantNotFound(producerId));
  });

  it("should throw an agreementActivationFailed when the requester is the Producer, the Agreement is Pending and there are invalid attributes", async () => {
    // TODO NOT NEEDED??? OR MAYBE NEEDED WHEN ALSO OTHER ATTRIBUTES ARE INVALID???? NOT ONLY CERTIFIED???
    const producer = getMockTenant();

    const revokedTenantCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: new Date(),
    };

    const revokedTenantDeclaredAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: new Date(),
    };

    const tenantVerifiedAttributeByAnotherProducer: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        { id: generateId<TenantId>(), verificationDate: new Date() },
      ],
    };

    const tenantVerfiedAttributeWithExpiredExtension: VerifiedTenantAttribute =
      {
        ...getMockVerifiedTenantAttribute(),
        verifiedBy: [
          {
            id: producer.id,
            verificationDate: new Date(),
            extensionDate: new Date(),
          },
        ],
      };

    const consumerInvalidAttribute: TenantAttribute = randomArrayItem([
      revokedTenantCertifiedAttribute,
      revokedTenantDeclaredAttribute,
      tenantVerifiedAttributeByAnotherProducer,
      tenantVerfiedAttributeWithExpiredExtension,
    ]);

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [consumerInvalidAttribute],
    };

    const authData = getRandomAuthData(producer.id);
    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: randomArrayItem(agreementActivationAllowedDescriptorStates),
      attributes: {
        certified:
          consumerInvalidAttribute.type === "PersistentCertifiedAttribute"
            ? [[getMockEServiceAttribute(consumerInvalidAttribute.id)]]
            : [[]],

        declared:
          consumerInvalidAttribute.type === "PersistentDeclaredAttribute"
            ? [[getMockEServiceAttribute(consumerInvalidAttribute.id)]]
            : [],
        verified:
          consumerInvalidAttribute.type === "PersistentVerifiedAttribute"
            ? [[getMockEServiceAttribute(consumerInvalidAttribute.id)]]
            : [],
      },
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      descriptors: [descriptor],
    };

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.pending,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: producer.id,
      consumerId: consumer.id,
    };

    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);

    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(agreementActivationFailed(agreement.id));
  });

  it("should throw agreementStampNotFound when the contract builder cannot find the submission stamp", async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    selfcareV2ClientMock.getUserInfoUsingGET = vi.fn(async () => undefined);

    const producer = getMockTenant();

    const validTenantCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const validTenantDeclaredAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const validTenantVerifiedAttribute: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producer.id,
          verificationDate: new Date(),
          extensionDate: new Date(new Date().getTime() + 3600 * 1000),
        },
      ],
    };

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        validTenantCertifiedAttribute,
        validTenantDeclaredAttribute,
        validTenantVerifiedAttribute,
      ],
    };

    const authData = getRandomAuthData(producer.id);
    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: randomArrayItem(agreementActivationAllowedDescriptorStates),
      attributes: {
        certified: [
          [getMockEServiceAttribute(validTenantCertifiedAttribute.id)],
        ],
        declared: [[getMockEServiceAttribute(validTenantDeclaredAttribute.id)]],
        verified: [[getMockEServiceAttribute(validTenantVerifiedAttribute.id)]],
      },
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      descriptors: [descriptor],
    };

    const mockAgreement: Agreement = getMockAgreement();
    const agreement: Agreement = {
      ...mockAgreement,
      state: agreementState.pending,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: producer.id,
      consumerId: consumer.id,
      suspendedByConsumer: false, // Must be false, otherwise the agreement would be suspended
      suspendedByProducer: randomBoolean(), // will be set to false by the activation
      stamps: {
        submission: undefined,
      },
    };

    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(agreementStampNotFound("submission"));
  });

  it("should throw userNotFound when the contract builder cannot fetch submission stamp user info from Selfcare API", async () => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    selfcareV2ClientMock.getUserInfoUsingGET = vi.fn(async () => undefined);

    const producer = getMockTenant();

    const validTenantCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const validTenantDeclaredAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const validTenantVerifiedAttribute: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producer.id,
          verificationDate: new Date(),
          extensionDate: new Date(new Date().getTime() + 3600 * 1000),
        },
      ],
    };

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        validTenantCertifiedAttribute,
        validTenantDeclaredAttribute,
        validTenantVerifiedAttribute,
      ],
    };

    const authData = getRandomAuthData(producer.id);
    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: randomArrayItem(agreementActivationAllowedDescriptorStates),
      attributes: {
        certified: [
          [getMockEServiceAttribute(validTenantCertifiedAttribute.id)],
        ],
        declared: [[getMockEServiceAttribute(validTenantDeclaredAttribute.id)]],
        verified: [[getMockEServiceAttribute(validTenantVerifiedAttribute.id)]],
      },
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      descriptors: [descriptor],
    };

    const mockAgreement: Agreement = getMockAgreement();
    const agreement: Agreement = {
      ...mockAgreement,
      state: agreementState.pending,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: producer.id,
      consumerId: consumer.id,
      suspendedByConsumer: false, // Must be false, otherwise the agreement would be suspended
      suspendedByProducer: randomBoolean(), // will be set to false by the activation
      stamps: {
        submission: {
          who: authData.userId,
          when: new Date(),
        },
        activation: undefined,
      },
    };

    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(userNotFound(authData.selfcareId, authData.userId));
  });

  it("should throw agreementMissingUserInfo when the contract builder cannot find name, surname or taxcode in submission stamp user info from Selfcare API", async () => {
    selfcareV2ClientMock.getUserInfoUsingGET = vi.fn(
      async () => mockSelfcareUserResponseWithMissingInfo
    );

    const producer = getMockTenant();

    const validTenantCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const validTenantDeclaredAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const validTenantVerifiedAttribute: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producer.id,
          verificationDate: new Date(),
          extensionDate: new Date(new Date().getTime() + 3600 * 1000),
        },
      ],
    };

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        validTenantCertifiedAttribute,
        validTenantDeclaredAttribute,
        validTenantVerifiedAttribute,
      ],
    };

    const authData = getRandomAuthData(producer.id);
    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: randomArrayItem(agreementActivationAllowedDescriptorStates),
      attributes: {
        certified: [
          [getMockEServiceAttribute(validTenantCertifiedAttribute.id)],
        ],
        declared: [[getMockEServiceAttribute(validTenantDeclaredAttribute.id)]],
        verified: [[getMockEServiceAttribute(validTenantVerifiedAttribute.id)]],
      },
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      descriptors: [descriptor],
    };

    const mockAgreement: Agreement = getMockAgreement();
    const agreement: Agreement = {
      ...mockAgreement,
      state: agreementState.pending,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: producer.id,
      consumerId: consumer.id,
      suspendedByConsumer: false, // Must be false, otherwise the agreement would be suspended
      suspendedByProducer: randomBoolean(), // will be set to false by the activation
      stamps: {
        submission: {
          who: authData.userId,
          when: new Date(),
        },
        activation: undefined,
      },
    };

    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(agreementMissingUserInfo(authData.userId));
  });

  it("should throw userNotFound when the contract builder cannot fetch activation stamp user info from Selfcare API", async () => {
    const anotherUserId = generateId<UserId>();

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    selfcareV2ClientMock.getUserInfoUsingGET = vi.fn(
      async ({ params: { id } }) =>
        id === anotherUserId ? mockSelfcareUserResponse : undefined
    );

    const producer = getMockTenant();

    const validTenantCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const validTenantDeclaredAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const validTenantVerifiedAttribute: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producer.id,
          verificationDate: new Date(),
          extensionDate: new Date(new Date().getTime() + 3600 * 1000),
        },
      ],
    };

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        validTenantCertifiedAttribute,
        validTenantDeclaredAttribute,
        validTenantVerifiedAttribute,
      ],
    };

    const authData = getRandomAuthData(producer.id);
    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: randomArrayItem(agreementActivationAllowedDescriptorStates),
      attributes: {
        certified: [
          [getMockEServiceAttribute(validTenantCertifiedAttribute.id)],
        ],
        declared: [[getMockEServiceAttribute(validTenantDeclaredAttribute.id)]],
        verified: [[getMockEServiceAttribute(validTenantVerifiedAttribute.id)]],
      },
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      descriptors: [descriptor],
    };

    const mockAgreement: Agreement = getMockAgreement();
    const agreement: Agreement = {
      ...mockAgreement,
      state: agreementState.pending,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: producer.id,
      consumerId: consumer.id,
      suspendedByConsumer: false, // Must be false, otherwise the agreement would be suspended
      suspendedByProducer: randomBoolean(), // will be set to false by the activation
      stamps: {
        submission: {
          who: anotherUserId,
          when: new Date(),
        },
        activation: undefined,
      },
    };

    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(userNotFound(authData.selfcareId, authData.userId));
  });

  it("should throw agreementMissingUserInfo when the contract builder cannot find name, surname or taxcode in activation stamp user info from Selfcare API", async () => {
    const anotherUserId = generateId<UserId>();

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    selfcareV2ClientMock.getUserInfoUsingGET = vi.fn(
      async ({ params: { id } }) =>
        id === anotherUserId
          ? mockSelfcareUserResponse
          : mockSelfcareUserResponseWithMissingInfo
    );

    const producer = getMockTenant();

    const validTenantCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const validTenantDeclaredAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const validTenantVerifiedAttribute: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producer.id,
          verificationDate: new Date(),
          extensionDate: new Date(new Date().getTime() + 3600 * 1000),
        },
      ],
    };

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        validTenantCertifiedAttribute,
        validTenantDeclaredAttribute,
        validTenantVerifiedAttribute,
      ],
    };

    const authData = getRandomAuthData(producer.id);
    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: randomArrayItem(agreementActivationAllowedDescriptorStates),
      attributes: {
        certified: [
          [getMockEServiceAttribute(validTenantCertifiedAttribute.id)],
        ],
        declared: [[getMockEServiceAttribute(validTenantDeclaredAttribute.id)]],
        verified: [[getMockEServiceAttribute(validTenantVerifiedAttribute.id)]],
      },
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      descriptors: [descriptor],
    };

    const mockAgreement: Agreement = getMockAgreement();
    const agreement: Agreement = {
      ...mockAgreement,
      state: agreementState.pending,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: producer.id,
      consumerId: consumer.id,
      suspendedByConsumer: false, // Must be false, otherwise the agreement would be suspended
      suspendedByProducer: randomBoolean(), // will be set to false by the activation
      stamps: {
        submission: {
          who: anotherUserId,
          when: new Date(),
        },
        activation: undefined,
      },
    };

    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(agreementMissingUserInfo(authData.userId));
  });

  it("should throw attributeNotFound when the contract builder cannot retrieve an attribute", async () => {
    const producer = getMockTenant();

    const validTenantCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const validTenantDeclaredAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };

    const validTenantVerifiedAttribute: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producer.id,
          verificationDate: new Date(),
          extensionDate: new Date(new Date().getTime() + 3600 * 1000),
        },
      ],
    };

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        validTenantCertifiedAttribute,
        validTenantDeclaredAttribute,
        validTenantVerifiedAttribute,
      ],
    };

    const authData = getRandomAuthData(producer.id);
    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: randomArrayItem(agreementActivationAllowedDescriptorStates),
      attributes: {
        certified: [
          [getMockEServiceAttribute(validTenantCertifiedAttribute.id)],
        ],
        declared: [[getMockEServiceAttribute(validTenantDeclaredAttribute.id)]],
        verified: [[getMockEServiceAttribute(validTenantVerifiedAttribute.id)]],
      },
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      descriptors: [descriptor],
    };

    const mockAgreement: Agreement = getMockAgreement();
    const agreement: Agreement = {
      ...mockAgreement,
      state: agreementState.pending,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: producer.id,
      consumerId: consumer.id,
      suspendedByConsumer: false, // Must be false, otherwise the agreement would be suspended
      suspendedByProducer: randomBoolean(), // will be set to false by the activation
      stamps: {
        submission: {
          who: authData.userId,
          when: new Date(),
        },
        activation: undefined,
      },
    };

    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(attributeNotFound(validTenantCertifiedAttribute.id));
  });

  it("should throw pdfGenerationError in case PDF generation fails", async () => {
    const producer = getMockTenant();

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

    const validTenantCertifiedAttribute: CertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(certifiedAttribute.id),
      revocationTimestamp: undefined,
    };

    const validTenantDeclaredAttribute: DeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(declaredAttribute.id),
      revocationTimestamp: undefined,
    };

    const validTenantVerifiedAttribute: VerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(verifiedAttribute.id),
      verifiedBy: [
        {
          id: producer.id,
          verificationDate: new Date(),
          extensionDate: new Date(new Date().getTime() + 3600 * 1000),
        },
      ],
    };

    const consumer: Tenant = {
      ...getMockTenant(),
      attributes: [
        validTenantCertifiedAttribute,
        validTenantDeclaredAttribute,
        validTenantVerifiedAttribute,
      ],
    };

    const authData = getRandomAuthData(producer.id);
    const descriptor: Descriptor = {
      ...getMockDescriptorPublished(),
      state: randomArrayItem(agreementActivationAllowedDescriptorStates),
      attributes: {
        certified: [
          [getMockEServiceAttribute(validTenantCertifiedAttribute.id)],
        ],
        declared: [[getMockEServiceAttribute(validTenantDeclaredAttribute.id)]],
        verified: [[getMockEServiceAttribute(validTenantVerifiedAttribute.id)]],
      },
    };

    const eservice: EService = {
      ...getMockEService(),
      producerId: producer.id,
      descriptors: [descriptor],
    };

    const mockAgreement: Agreement = getMockAgreement();
    const agreement: Agreement = {
      ...mockAgreement,
      state: agreementState.pending,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: producer.id,
      consumerId: consumer.id,
      suspendedByConsumer: false, // Must be false, otherwise the agreement would be suspended
      suspendedByProducer: randomBoolean(), // will be set to false by the activation
      stamps: {
        submission: {
          who: authData.userId,
          when: new Date(),
        },
        activation: undefined,
      },
    };

    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await addOneAttribute(certifiedAttribute);
    await addOneAttribute(declaredAttribute);
    await addOneAttribute(verifiedAttribute);

    await closeTestBrowserInstance();
    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      pdfGenerationError("Protocol error: Connection closed.")
    );

    await respawnTestBrowserInstance();
  });
});
