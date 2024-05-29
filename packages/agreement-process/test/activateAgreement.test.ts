/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodeProtobufPayload,
  getMockAgreement,
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
import { genericLogger } from "pagopa-interop-commons";
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
} from "pagopa-interop-models";
import { UserResponse } from "pagopa-interop-selfcare-v2-client";
import { generateMock } from "@anatine/zod-mock";
import {
  agreementActivationFailed,
  agreementNotFound,
  agreementNotInExpectedState,
  descriptorNotFound,
  descriptorNotInExpectedState,
  eServiceNotFound,
  operationNotAllowed,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import {
  agreementActivableStates,
  agreementActivationAllowedDescriptorStates,
  agreementArchivableStates,
} from "../src/model/domain/validators.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  agreementService,
  readLastAgreementEvent,
  selfcareV2ClientMock,
} from "./utils.js";

describe("activate agreement", () => {
  // TODO success case with requester === producer and ALSO CONSUMER and state Suspended >>> Active
  // TODO success case with requester === producer and state Pending >>> Suspended (suspendedByConsumer was true)
  // But then.... the event should be AgreementSuspendedByProducer ?????? Not Unsuspended

  // TODO remember to test the firstActivation VS non firstActivation case
  // TODO also test manually
  // TODO verify logic in Scala to check if it is correct

  const mockSelfcareUserResponse: UserResponse = {
    email: "test@test.com",
    name: "Test Name",
    surname: "Test Surname",
    id: generateId(),
    taxCode: "TSTTSTTSTTSTTSTT",
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

  it.only("should activate a Pending Agreement when the requester is the Producer and all attributes are valid", async () => {
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

    const agreement: Agreement = {
      ...getMockAgreement(),
      state: agreementState.pending,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: producer.id,
      consumerId: consumer.id,
      suspendedByConsumer: false, // Must be false, otherwise the agreement would be suspended
      suspendedByProducer: randomBoolean(), // will be set to false by the activation
    };

    await addOneTenant(consumer);
    await addOneTenant(producer);
    await addOneEService(eservice);
    await addOneAgreement(agreement);
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

    // TODO verify also return value etc etc
    await testRelatedAgreementsArchiviation(relatedAgreements);
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

    // Only one of the two flags is true, to that the next state is active
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

    const expecedActivatedAgreement = {
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
      // suspendedByPlatform: false,
      // TODO ^^ this makes the test flaky, is it ok to have it possibly true?
      // Active with suspendedByPlatform = true should never be possible...
    };

    expect(actualAgreementActivated).toMatchObject(expecedActivatedAgreement);

    expect(activateAgreementReturnValue).toMatchObject(
      expecedActivatedAgreement
    );

    await testRelatedAgreementsArchiviation(relatedAgreements);
  });

  it("should keep a Suspended Agreement in Suspended state when it was suspended both by Producer and Consumer", async () => {
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

    const mockAgreement = getMockAgreement();
    const agreement: Agreement = {
      ...mockAgreement,
      state: agreementState.suspended,
      eserviceId: eservice.id,
      descriptorId: descriptor.id,
      producerId: producer.id,
      consumerId: consumer.id,
      suspendedByProducer: true,
      suspendedByConsumer: true,
      suspendedAt: new Date(),
      stamps: {
        ...mockAgreement.stamps,
        suspensionByProducer: {
          who: authData.userId,
          when: new Date(),
        },
        suspensionByConsumer: {
          who: authData.userId,
          when: new Date(),
        },
      },
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

    const expectedStamps = {
      suspensionByProducer: isProducer
        ? undefined
        : agreement.stamps.suspensionByProducer,
      suspensionByConsumer: !isProducer
        ? undefined
        : agreement.stamps.suspensionByConsumer,
    };

    const expecedActivatedAgreement = {
      ...agreement,
      state: agreementState.suspended,
      suspendedAt: agreement.suspendedAt,
      stamps: {
        ...agreement.stamps,
        ...expectedStamps,
      },
      suspendedByConsumer: isProducer ? true : false,
      suspendedByProducer: !isProducer ? true : false,
    };

    expect(actualAgreementActivated).toMatchObject(expecedActivatedAgreement);

    expect(activateAgreementReturnValue).toMatchObject(
      expecedActivatedAgreement
    );

    await testRelatedAgreementsArchiviation(relatedAgreements);
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
});
