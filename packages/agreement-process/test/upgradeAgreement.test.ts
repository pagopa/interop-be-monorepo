/* eslint-disable functional/no-let */
/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable fp/no-delete */
/* eslint-disable functional/immutable-data */
import { FileManagerError, genericLogger } from "pagopa-interop-commons";
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
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementAddedV2,
  AgreementArchivedByUpgradeV2,
  AgreementDocument,
  AgreementDocumentId,
  AgreementId,
  AgreementUpgradedV2,
  AgreementV2,
  Descriptor,
  DescriptorId,
  EService,
  EServiceId,
  TenantId,
  agreementState,
  descriptorState,
  generateId,
  toAgreementV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  agreementAlreadyExists,
  agreementNotFound,
  agreementNotInExpectedState,
  descriptorNotFound,
  eServiceNotFound,
  missingCertifiedAttributesError,
  noNewerDescriptor,
  operationNotAllowed,
  publishedDescriptorNotFound,
  tenantNotFound,
  unexpectedVersionFormat,
} from "../src/model/domain/errors.js";
import { agreementUpgradableStates } from "../src/model/domain/validators.js";
import { config } from "../src/utilities/config.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  agreementService,
  fileManager,
  getMockConsumerDocument,
  readAgreementEventByVersion,
  uploadDocument,
} from "./utils.js";

describe("upgrade Agreement", () => {
  const TEST_EXECUTION_DATE = new Date();

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TEST_EXECUTION_DATE);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should succeed with valid Verified and Declared attributes when consumer and producer are the same", async () => {
    const authData = getRandomAuthData();
    const producerAndConsumerId = authData.organizationId;
    const agreementId = generateId<AgreementId>();
    const documentNumber = Math.floor(Math.random() * 10) + 1;
    const agreementConsumerDocuments = Array.from(
      { length: documentNumber },
      () => getMockConsumerDocument(agreementId)
    );

    const validVerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producerAndConsumerId,
          verificationDate: new Date(TEST_EXECUTION_DATE.getFullYear() - 1),
          expirationDate: new Date(TEST_EXECUTION_DATE.getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
    };

    const validVerifiedEserviceAttribute = getMockEServiceAttribute(
      validVerifiedTenantAttribute.id
    );

    const validDeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const validDeclaredEserviceAttribute = getMockEServiceAttribute(
      validDeclaredTenantAttribute.id
    );

    // Certified attributes are not verified when producer and consumer are the same,
    // so the test shall pass even with this invalid attribute
    const invalidCertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: new Date(),
    };
    const invalidCertifiedEserviceAttribute = getMockEServiceAttribute(
      invalidCertifiedTenantAttribute.id
    );

    const descriptorId = generateId<DescriptorId>();
    const deprecatedDescriptor = {
      ...getMockDescriptorPublished(
        descriptorId,
        [[invalidCertifiedEserviceAttribute]],
        [[validDeclaredEserviceAttribute]],
        [[validVerifiedEserviceAttribute]]
      ),
      path: "/deprecatedDescriptor/doc",
      state: descriptorState.deprecated,
      version: "1",
    };

    const publishedDescriptor: Descriptor = {
      ...getMockDescriptorPublished(
        descriptorId,
        [[invalidCertifiedEserviceAttribute]],
        [[validDeclaredEserviceAttribute]],
        [[validVerifiedEserviceAttribute]]
      ),
      version: "2",
    };

    const producerAndConsumer = getMockTenant(producerAndConsumerId, [
      invalidCertifiedTenantAttribute,
      validDeclaredTenantAttribute,
      validVerifiedTenantAttribute,
    ]);
    const agreementToBeUpgraded: Agreement = {
      ...getMockAgreement(
        generateId<EServiceId>(),
        producerAndConsumer.id, // Consumer and producer are the same
        randomArrayItem(agreementUpgradableStates)
      ),
      id: agreementId,
      descriptorId,
      producerId: producerAndConsumer.id,
      createdAt: TEST_EXECUTION_DATE,
      consumerDocuments: agreementConsumerDocuments,
    };

    for (const doc of agreementConsumerDocuments) {
      await uploadDocument(agreementId, doc.id, doc.name);
    }

    const eservice = getMockEService(
      agreementToBeUpgraded.eserviceId,
      producerAndConsumer.id,
      [deprecatedDescriptor, publishedDescriptor]
    );

    await addOneEService(eservice);
    await addOneTenant(producerAndConsumer);
    await addOneAgreement(agreementToBeUpgraded);

    const returnedAgreement = await agreementService.upgradeAgreement(
      agreementToBeUpgraded.id,
      {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      }
    );
    const newAgreementId = unsafeBrandId<AgreementId>(returnedAgreement.id);

    const actualAgreementArchivedEvent = await readAgreementEventByVersion(
      agreementToBeUpgraded.id,
      1
    );

    expect(actualAgreementArchivedEvent).toMatchObject({
      type: "AgreementArchivedByUpgrade",
      event_version: 2,
      version: "1",
      stream_id: agreementToBeUpgraded.id,
    });

    const actualAgreementArchived = decodeProtobufPayload({
      messageType: AgreementArchivedByUpgradeV2,
      payload: actualAgreementArchivedEvent.data,
    }).agreement;

    const expectedAgreementArchived: Agreement = {
      ...agreementToBeUpgraded,
      state: agreementState.archived,
      stamps: {
        ...agreementToBeUpgraded.stamps,
        archiving: {
          who: authData.userId,
          when: TEST_EXECUTION_DATE,
        },
      },
    };

    expect(actualAgreementArchived).toMatchObject(
      toAgreementV2(expectedAgreementArchived)
    );

    expect(newAgreementId).toBeDefined();

    const actualAgreementUpgradedEvent = await readAgreementEventByVersion(
      newAgreementId,
      0
    );

    expect(actualAgreementUpgradedEvent).toMatchObject({
      type: "AgreementUpgraded",
      event_version: 2,
      version: "0",
      stream_id: newAgreementId,
    });

    const actualAgreementUpgraded: AgreementV2 | undefined =
      decodeProtobufPayload({
        messageType: AgreementUpgradedV2,
        payload: actualAgreementUpgradedEvent.data,
      }).agreement;

    const expectedUpgradedAgreement = toAgreementV2({
      ...agreementToBeUpgraded,
      id: newAgreementId,
      descriptorId: publishedDescriptor.id,
      createdAt: TEST_EXECUTION_DATE,
      stamps: {
        ...agreementToBeUpgraded.stamps,
        upgrade: {
          who: authData.userId,
          when: TEST_EXECUTION_DATE,
        },
      },
      consumerDocuments: agreementConsumerDocuments.map((doc, i) => ({
        ...doc,
        id: unsafeBrandId<AgreementDocumentId>(
          actualAgreementUpgraded?.consumerDocuments[i].id as string
        ),
        path: actualAgreementUpgraded?.consumerDocuments[i].path as string,
      })),
    });

    // The method toAgreementV2 sets these to undefined,
    // while when we read the event data they are not present
    delete expectedUpgradedAgreement.updatedAt;
    delete expectedUpgradedAgreement.rejectionReason;
    expect(actualAgreementUpgraded).toMatchObject(expectedUpgradedAgreement);
    expect(actualAgreementUpgraded).toEqual(toAgreementV2(returnedAgreement));

    for (const agreementDoc of expectedUpgradedAgreement.consumerDocuments) {
      const expectedUploadedDocumentPath = `${config.consumerDocumentsPath}/${newAgreementId}/${agreementDoc.id}/${agreementDoc.name}`;

      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).toContainEqual(expectedUploadedDocumentPath);
    }
  });

  it("should succeed with valid Verified, Certified, and Declared attributes when consumer and producer are different", async () => {
    const authData = getRandomAuthData();
    const consumerId = authData.organizationId;
    const producerId = generateId<TenantId>();
    const agreementId = generateId<AgreementId>();
    const agreementConsumerDocument = getMockConsumerDocument(agreementId);

    const validVerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producerId,
          verificationDate: new Date(TEST_EXECUTION_DATE.getFullYear() - 1),
          expirationDate: new Date(TEST_EXECUTION_DATE.getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
    };

    const validVerifiedEserviceAttribute = getMockEServiceAttribute(
      validVerifiedTenantAttribute.id
    );

    const validDeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const validDeclaredEserviceAttribute = getMockEServiceAttribute(
      validDeclaredTenantAttribute.id
    );

    const validCertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const validCertifiedEserviceAttribute = getMockEServiceAttribute(
      validCertifiedTenantAttribute.id
    );

    const descriptorId = generateId<DescriptorId>();
    const deprecatedDescriptor = {
      ...getMockDescriptorPublished(
        descriptorId,
        [[validCertifiedEserviceAttribute]],
        [[validDeclaredEserviceAttribute]],
        [[validVerifiedEserviceAttribute]]
      ),
      path: "/deprecatedDescriptor/doc",
      state: descriptorState.deprecated,
      version: "1",
    };

    const publishedDescriptor: Descriptor = {
      ...getMockDescriptorPublished(
        descriptorId,
        [[validCertifiedEserviceAttribute]],
        [[validDeclaredEserviceAttribute]],
        [[validVerifiedEserviceAttribute]]
      ),
      version: "2",
    };

    const consumer = getMockTenant(consumerId, [
      validCertifiedTenantAttribute,
      validDeclaredTenantAttribute,
      validVerifiedTenantAttribute,
    ]);

    const agreementToBeUpgraded: Agreement = {
      ...getMockAgreement(
        generateId<EServiceId>(),
        consumer.id, // Consumer and producer are different
        randomArrayItem(agreementUpgradableStates)
      ),
      id: agreementId,
      descriptorId,
      producerId,
      createdAt: TEST_EXECUTION_DATE,
      consumerDocuments: [agreementConsumerDocument],
    };

    await uploadDocument(
      agreementToBeUpgraded.id,
      agreementConsumerDocument.id,
      agreementConsumerDocument.name
    );

    const eservice = getMockEService(
      agreementToBeUpgraded.eserviceId,
      producerId,
      [deprecatedDescriptor, publishedDescriptor]
    );

    await addOneEService(eservice);
    await addOneTenant(consumer);
    await addOneAgreement(agreementToBeUpgraded);

    const returnedAgreement = await agreementService.upgradeAgreement(
      agreementToBeUpgraded.id,
      {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      }
    );
    const newAgreementId = unsafeBrandId<AgreementId>(returnedAgreement.id);

    const actualAgreementArchivedEvent = await readAgreementEventByVersion(
      agreementToBeUpgraded.id,
      1
    );

    expect(actualAgreementArchivedEvent).toMatchObject({
      type: "AgreementArchivedByUpgrade",
      event_version: 2,
      version: "1",
      stream_id: agreementToBeUpgraded.id,
    });

    const actualAgreementArchived = decodeProtobufPayload({
      messageType: AgreementArchivedByUpgradeV2,
      payload: actualAgreementArchivedEvent.data,
    }).agreement;

    const expectedAgreementArchived: Agreement = {
      ...agreementToBeUpgraded,
      state: agreementState.archived,
      stamps: {
        ...agreementToBeUpgraded.stamps,
        archiving: {
          who: authData.userId,
          when: TEST_EXECUTION_DATE,
        },
      },
    };

    expect(actualAgreementArchived).toMatchObject(
      toAgreementV2(expectedAgreementArchived)
    );

    expect(newAgreementId).toBeDefined();

    const actualAgreementUpgradedEvent = await readAgreementEventByVersion(
      newAgreementId,
      0
    );

    expect(actualAgreementUpgradedEvent).toMatchObject({
      type: "AgreementUpgraded",
      event_version: 2,
      version: "0",
      stream_id: newAgreementId,
    });

    const actualAgreementUpgraded: AgreementV2 | undefined =
      decodeProtobufPayload({
        messageType: AgreementUpgradedV2,
        payload: actualAgreementUpgradedEvent.data,
      }).agreement;

    const expectedUpgradedAgreement = toAgreementV2({
      ...agreementToBeUpgraded,
      id: newAgreementId,
      descriptorId: publishedDescriptor.id,
      createdAt: TEST_EXECUTION_DATE,
      stamps: {
        ...agreementToBeUpgraded.stamps,
        upgrade: {
          who: authData.userId,
          when: TEST_EXECUTION_DATE,
        },
      },
      consumerDocuments: [
        {
          ...agreementConsumerDocument,
          id: unsafeBrandId<AgreementDocumentId>(
            actualAgreementUpgraded?.consumerDocuments[0].id as string
          ),
          path: actualAgreementUpgraded?.consumerDocuments[0].path as string,
        },
      ],
    });

    // The method toAgreementV2 sets these to undefined,
    // while when we read the event data they are not present
    delete expectedUpgradedAgreement.updatedAt;
    delete expectedUpgradedAgreement.rejectionReason;
    expect(actualAgreementUpgraded).toMatchObject(expectedUpgradedAgreement);
    expect(actualAgreementUpgraded).toEqual(toAgreementV2(returnedAgreement));

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContainEqual(expectedUpgradedAgreement.consumerDocuments[0].path);
  });

  it("should succeed with invalid Verified attributes", async () => {
    const authData = getRandomAuthData();
    const consumerId = authData.organizationId;
    const producerId = generateId<TenantId>();
    const descriptorId = generateId<DescriptorId>();
    const agreementId = generateId<AgreementId>();
    const agreementConsumerDocument = getMockConsumerDocument(agreementId);

    const validCertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const validCertifiedEserviceAttribute = getMockEServiceAttribute(
      validCertifiedTenantAttribute.id
    );

    const invalidVerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producerId,
          verificationDate: new Date(TEST_EXECUTION_DATE.getFullYear() - 1),
          expirationDate: new Date(TEST_EXECUTION_DATE.getFullYear() + 1),
          extensionDate: new Date(TEST_EXECUTION_DATE.getFullYear() - 1), // invalid because of this
        },
      ],
    };
    const invalidVerifiedEserviceAttribute = getMockEServiceAttribute(
      invalidVerifiedTenantAttribute.id
    );

    const tenant = getMockTenant(consumerId, [
      invalidVerifiedTenantAttribute,
      validCertifiedTenantAttribute,
    ]);
    await addOneTenant(tenant);

    const deprecatedDescriptor = {
      ...getMockDescriptorPublished(
        descriptorId,
        [[validCertifiedEserviceAttribute]],
        [],
        [[invalidVerifiedEserviceAttribute]]
      ),
      state: descriptorState.deprecated,
      version: "1",
    };

    const publishedDescriptor = {
      ...getMockDescriptorPublished(
        descriptorId,
        [[validCertifiedEserviceAttribute]],
        [],
        [[invalidVerifiedEserviceAttribute]]
      ),
      version: "2",
    };

    await uploadDocument(
      agreementId,
      agreementConsumerDocument.id,
      agreementConsumerDocument.name
    );

    const agreementToBeUpgraded: Agreement = {
      ...getMockAgreement(
        generateId<EServiceId>(),
        consumerId,
        randomArrayItem(agreementUpgradableStates)
      ),
      id: agreementId,
      descriptorId,
      producerId,
      stamps: {},
      createdAt: TEST_EXECUTION_DATE,
      consumerDocuments: [agreementConsumerDocument],
    };

    await addOneAgreement(agreementToBeUpgraded);

    const eservice: EService = getMockEService(
      agreementToBeUpgraded.eserviceId,
      tenant.id,
      [deprecatedDescriptor, publishedDescriptor]
    );
    await addOneEService(eservice);

    const returnedAgreement = await agreementService.upgradeAgreement(
      agreementToBeUpgraded.id,
      {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      }
    );
    const newAgreementId = unsafeBrandId<AgreementId>(returnedAgreement.id);

    expect(newAgreementId).toBeDefined();

    const actualAgreementCreatedEvent = await readAgreementEventByVersion(
      newAgreementId,
      0
    );

    expect(actualAgreementCreatedEvent).toMatchObject({
      type: "AgreementAdded",
      event_version: 2,
      version: "0",
      stream_id: newAgreementId,
    });

    const actualCreatedAgreementV2 = decodeProtobufPayload({
      messageType: AgreementAddedV2,
      payload: actualAgreementCreatedEvent.data,
    }).agreement;

    const expectedCreatedAgreement = toAgreementV2({
      id: newAgreementId,
      eserviceId: agreementToBeUpgraded.eserviceId,
      descriptorId,
      producerId: agreementToBeUpgraded.producerId,
      consumerId: agreementToBeUpgraded.consumerId,
      verifiedAttributes: agreementToBeUpgraded.verifiedAttributes,
      certifiedAttributes: agreementToBeUpgraded.certifiedAttributes,
      declaredAttributes: agreementToBeUpgraded.declaredAttributes,
      consumerNotes: agreementToBeUpgraded.consumerNotes,
      state: agreementState.draft,
      createdAt: TEST_EXECUTION_DATE,
      consumerDocuments: [
        {
          id: unsafeBrandId<AgreementDocumentId>(
            actualCreatedAgreementV2?.consumerDocuments[0].id as string
          ),
          name: agreementConsumerDocument.name,
          prettyName: agreementConsumerDocument.prettyName,
          contentType: agreementConsumerDocument.contentType,
          path: actualCreatedAgreementV2?.consumerDocuments[0].path as string,
          createdAt: TEST_EXECUTION_DATE,
        },
      ],
      stamps: {},
    });

    expectedCreatedAgreement.stamps = {};
    delete expectedCreatedAgreement.updatedAt;
    delete expectedCreatedAgreement.suspendedAt;
    delete expectedCreatedAgreement.contract;
    expect(actualCreatedAgreementV2).toMatchObject(expectedCreatedAgreement);
    expect(actualCreatedAgreementV2).toEqual(toAgreementV2(returnedAgreement));

    const expectedUploadedDocumentPath = `${
      config.consumerDocumentsPath
    }/${newAgreementId}/${
      actualCreatedAgreementV2?.consumerDocuments[0].id as string
    }/${agreementConsumerDocument.name}`;

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContainEqual(expectedUploadedDocumentPath);
  });

  it("should succeed with invalid Declared attributes", async () => {
    const authData = getRandomAuthData();
    const consumerId = authData.organizationId;
    const producerId = generateId<TenantId>();
    const descriptorId = generateId<DescriptorId>();
    const agreementId = generateId<AgreementId>();
    const agreementConsumerDocument = getMockConsumerDocument(agreementId);

    const validVerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producerId,
          verificationDate: new Date(TEST_EXECUTION_DATE.getFullYear() - 1),
          expirationDate: new Date(TEST_EXECUTION_DATE.getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
    };

    const validVerifiedEserviceAttribute = getMockEServiceAttribute(
      validVerifiedTenantAttribute.id
    );

    const invalidDeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: new Date(TEST_EXECUTION_DATE.getFullYear() + 1),
    };
    const invalidDecalredEserviceAttribute = getMockEServiceAttribute(
      invalidDeclaredTenantAttribute.id
    );

    const validCertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const validCertifiedEserviceAttribute = getMockEServiceAttribute(
      validCertifiedTenantAttribute.id
    );

    const tenant = getMockTenant(consumerId, [
      validCertifiedTenantAttribute,
      validVerifiedTenantAttribute,
      invalidDeclaredTenantAttribute,
    ]);
    await addOneTenant(tenant);

    const deprecatedDescriptor = {
      ...getMockDescriptorPublished(
        descriptorId,
        [[validCertifiedEserviceAttribute]],
        [[invalidDecalredEserviceAttribute]],
        [[validVerifiedEserviceAttribute]]
      ),
      name: "deprecated-descriptor-doc",
      state: descriptorState.deprecated,
      version: "1",
    };

    const publishedDescriptor = {
      ...getMockDescriptorPublished(
        descriptorId,
        [[validCertifiedEserviceAttribute]],
        [[invalidDecalredEserviceAttribute]],
        [[validVerifiedEserviceAttribute]]
      ),
      version: "2",
    };

    await uploadDocument(
      agreementId,
      agreementConsumerDocument.id,
      agreementConsumerDocument.name
    );

    const agreementToBeUpgraded: Agreement = {
      ...getMockAgreement(
        generateId<EServiceId>(),
        consumerId,
        randomArrayItem(agreementUpgradableStates)
      ),
      id: agreementId,
      descriptorId,
      producerId,
      stamps: {},
      createdAt: TEST_EXECUTION_DATE,
      consumerDocuments: [agreementConsumerDocument],
    };

    await addOneAgreement(agreementToBeUpgraded);

    const eservice: EService = getMockEService(
      agreementToBeUpgraded.eserviceId,
      tenant.id,
      [deprecatedDescriptor, publishedDescriptor]
    );
    await addOneEService(eservice);

    const returnedAgreement = await agreementService.upgradeAgreement(
      agreementToBeUpgraded.id,
      {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      }
    );
    const newAgreementId = unsafeBrandId<AgreementId>(returnedAgreement.id);

    expect(newAgreementId).toBeDefined();
    const actualAgreementCreatedEvent = await readAgreementEventByVersion(
      newAgreementId,
      0
    );

    expect(actualAgreementCreatedEvent).toMatchObject({
      type: "AgreementAdded",
      event_version: 2,
      version: "0",
      stream_id: newAgreementId,
    });

    const actualCreatedAgreement = decodeProtobufPayload({
      messageType: AgreementAddedV2,
      payload: actualAgreementCreatedEvent.data,
    }).agreement;

    const expectedCreatedAgreement = toAgreementV2({
      id: newAgreementId,
      eserviceId: agreementToBeUpgraded.eserviceId,
      descriptorId,
      producerId: agreementToBeUpgraded.producerId,
      consumerId: agreementToBeUpgraded.consumerId,
      verifiedAttributes: agreementToBeUpgraded.verifiedAttributes,
      certifiedAttributes: agreementToBeUpgraded.certifiedAttributes,
      declaredAttributes: agreementToBeUpgraded.declaredAttributes,
      consumerNotes: agreementToBeUpgraded.consumerNotes,
      state: agreementState.draft,
      createdAt: TEST_EXECUTION_DATE,
      consumerDocuments: [
        {
          id: unsafeBrandId<AgreementDocumentId>(
            actualCreatedAgreement?.consumerDocuments[0].id as string
          ),
          name: agreementConsumerDocument.name,
          prettyName: agreementConsumerDocument.prettyName,
          contentType: agreementConsumerDocument.contentType,
          path: actualCreatedAgreement?.consumerDocuments[0].path as string,
          createdAt: TEST_EXECUTION_DATE,
        },
      ],
      stamps: {},
    });

    expectedCreatedAgreement.stamps = {};
    delete expectedCreatedAgreement.updatedAt;
    delete expectedCreatedAgreement.suspendedAt;
    delete expectedCreatedAgreement.contract;
    expect(actualCreatedAgreement).toMatchObject(expectedCreatedAgreement);
    expect(actualCreatedAgreement).toEqual(toAgreementV2(returnedAgreement));

    const expectedUploadedDocumentPath = `${config.consumerDocumentsPath}/${newAgreementId}/${actualCreatedAgreement?.consumerDocuments[0].id}/${agreementConsumerDocument.name}`;

    expect(
      await fileManager.listFiles(config.s3Bucket, genericLogger)
    ).toContainEqual(expectedUploadedDocumentPath);
  });

  it("should succeed with invalid Declared attributes with multiple documents", async () => {
    const authData = getRandomAuthData();
    const consumerId = authData.organizationId;
    const producerId = generateId<TenantId>();
    const descriptorId = generateId<DescriptorId>();
    const agreementId = generateId<AgreementId>();
    const documentNumber = Math.floor(Math.random() * 10) + 1;
    const agreementConsumerDocuments = Array.from(
      { length: documentNumber },
      () => getMockConsumerDocument(agreementId)
    );

    const validVerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producerId,
          verificationDate: new Date(TEST_EXECUTION_DATE.getFullYear() - 1),
          expirationDate: new Date(TEST_EXECUTION_DATE.getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
    };

    const validVerifiedEserviceAttribute = getMockEServiceAttribute(
      validVerifiedTenantAttribute.id
    );

    const invalidDeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: new Date(TEST_EXECUTION_DATE.getFullYear() + 1),
    };
    const invalidDecalredEserviceAttribute = getMockEServiceAttribute(
      invalidDeclaredTenantAttribute.id
    );

    const validCertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const validCertifiedEserviceAttribute = getMockEServiceAttribute(
      validCertifiedTenantAttribute.id
    );

    const tenant = getMockTenant(consumerId, [
      validCertifiedTenantAttribute,
      validVerifiedTenantAttribute,
      invalidDeclaredTenantAttribute,
    ]);
    await addOneTenant(tenant);

    const deprecatedDescriptor = {
      ...getMockDescriptorPublished(
        descriptorId,
        [[validCertifiedEserviceAttribute]],
        [[invalidDecalredEserviceAttribute]],
        [[validVerifiedEserviceAttribute]]
      ),
      name: "deprecated-descriptor-doc",
      state: descriptorState.deprecated,
      version: "1",
    };

    const publishedDescriptor = {
      ...getMockDescriptorPublished(
        descriptorId,
        [[validCertifiedEserviceAttribute]],
        [[invalidDecalredEserviceAttribute]],
        [[validVerifiedEserviceAttribute]]
      ),
      version: "2",
    };

    for (const doc of agreementConsumerDocuments) {
      await uploadDocument(agreementId, doc.id, doc.name);
    }

    const agreementToBeUpgraded: Agreement = {
      ...getMockAgreement(
        generateId<EServiceId>(),
        consumerId,
        randomArrayItem(agreementUpgradableStates)
      ),
      id: agreementId,
      descriptorId,
      producerId,
      stamps: {},
      createdAt: TEST_EXECUTION_DATE,
      consumerDocuments: agreementConsumerDocuments,
    };

    await addOneAgreement(agreementToBeUpgraded);

    const eservice: EService = getMockEService(
      agreementToBeUpgraded.eserviceId,
      tenant.id,
      [deprecatedDescriptor, publishedDescriptor]
    );
    await addOneEService(eservice);

    const returnedAgreement = await agreementService.upgradeAgreement(
      agreementToBeUpgraded.id,
      {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      }
    );
    const newAgreementId = unsafeBrandId<AgreementId>(returnedAgreement.id);

    expect(newAgreementId).toBeDefined();
    const actualAgreementCreatedEvent = await readAgreementEventByVersion(
      newAgreementId,
      0
    );

    expect(actualAgreementCreatedEvent).toMatchObject({
      type: "AgreementAdded",
      event_version: 2,
      version: "0",
      stream_id: newAgreementId,
    });

    const actualCreatedAgreement = decodeProtobufPayload({
      messageType: AgreementAddedV2,
      payload: actualAgreementCreatedEvent.data,
    }).agreement;

    const expectedCreatedAgreement = toAgreementV2({
      id: newAgreementId,
      eserviceId: agreementToBeUpgraded.eserviceId,
      descriptorId,
      producerId: agreementToBeUpgraded.producerId,
      consumerId: agreementToBeUpgraded.consumerId,
      verifiedAttributes: agreementToBeUpgraded.verifiedAttributes,
      certifiedAttributes: agreementToBeUpgraded.certifiedAttributes,
      declaredAttributes: agreementToBeUpgraded.declaredAttributes,
      consumerNotes: agreementToBeUpgraded.consumerNotes,
      state: agreementState.draft,
      createdAt: TEST_EXECUTION_DATE,
      consumerDocuments: agreementConsumerDocuments.map<AgreementDocument>(
        (doc, i) => ({
          ...doc,
          id: unsafeBrandId(
            actualCreatedAgreement?.consumerDocuments[i].id as string
          ),
          path: actualCreatedAgreement?.consumerDocuments[i].path as string,
        })
      ),
      stamps: {},
    });

    expectedCreatedAgreement.stamps = {};
    delete expectedCreatedAgreement.updatedAt;
    delete expectedCreatedAgreement.suspendedAt;
    delete expectedCreatedAgreement.contract;
    expect(actualCreatedAgreement).toMatchObject(expectedCreatedAgreement);
    expect(actualCreatedAgreement).toEqual(toAgreementV2(returnedAgreement));

    for (const agreementDoc of expectedCreatedAgreement.consumerDocuments) {
      const expectedUploadedDocumentPath = `${config.consumerDocumentsPath}/${newAgreementId}/${agreementDoc.id}/${agreementDoc.name}`;

      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).toContainEqual(expectedUploadedDocumentPath);
    }
  });

  it("should throw a tenantNotFound error when the tenant does not exist", async () => {
    const authData = getRandomAuthData();
    const producerAndConsumerId = authData.organizationId;
    const agreementId = generateId<AgreementId>();

    const validVerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: producerAndConsumerId,
          verificationDate: new Date(TEST_EXECUTION_DATE.getFullYear() - 1),
          expirationDate: new Date(TEST_EXECUTION_DATE.getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
    };

    const validVerifiedEserviceAttribute = getMockEServiceAttribute(
      validVerifiedTenantAttribute.id
    );

    const validDeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: undefined,
    };
    const validDeclaredEserviceAttribute = getMockEServiceAttribute(
      validDeclaredTenantAttribute.id
    );

    // Certified attributes are not verified when producer and consumer are the same,
    // so the test shall pass even with this invalid attribute
    const invalidCertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: new Date(),
    };
    const invalidCertifiedEserviceAttribute = getMockEServiceAttribute(
      invalidCertifiedTenantAttribute.id
    );

    const descriptorId = generateId<DescriptorId>();
    const deprecatedDescriptor = {
      ...getMockDescriptorPublished(
        descriptorId,
        [[invalidCertifiedEserviceAttribute]],
        [[validDeclaredEserviceAttribute]],
        [[validVerifiedEserviceAttribute]]
      ),
      path: "/deprecatedDescriptor/doc",
      state: descriptorState.deprecated,
      version: "1",
    };

    const publishedDescriptor: Descriptor = {
      ...getMockDescriptorPublished(
        descriptorId,
        [[invalidCertifiedEserviceAttribute]],
        [[validDeclaredEserviceAttribute]],
        [[validVerifiedEserviceAttribute]]
      ),
      version: "2",
    };

    const agreement = {
      ...getMockAgreement(
        generateId<EServiceId>(),
        producerAndConsumerId, // Consumer and producer are the same
        randomArrayItem(agreementUpgradableStates)
      ),
      id: agreementId,
      descriptorId,
      producerId: producerAndConsumerId,
    };

    const eservice = getMockEService(
      agreement.eserviceId,
      producerAndConsumerId,
      [deprecatedDescriptor, publishedDescriptor]
    );

    await addOneEService(eservice);
    await addOneAgreement(agreement);
    await expect(
      agreementService.upgradeAgreement(agreementId, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(tenantNotFound(producerAndConsumerId));
  });

  it("should throw an agreementNotFound error when the agreement does not exist", async () => {
    const authData = getRandomAuthData();
    const agreementId = generateId<AgreementId>();

    const tenantId = authData.organizationId;
    const tenant = getMockTenant(tenantId);

    await addOneTenant(tenant);
    await expect(
      agreementService.upgradeAgreement(agreementId, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });

  it("should throw an operationNotAllowed error when the requester is different from consumer", async () => {
    const authData = getRandomAuthData();
    const tenantId = authData.organizationId;
    const tenant = getMockTenant(tenantId);
    await addOneTenant(tenant);

    const agreement = getMockAgreement(
      generateId<EServiceId>(),
      generateId<TenantId>(),
      randomArrayItem(agreementUpgradableStates)
    );

    await addOneAgreement(agreement);
    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should throw an agreementNotInExpectedState error when the agreement doesn't have an upgradable states", async () => {
    const authData = getRandomAuthData();
    const tenantId = authData.organizationId;
    const tenant = getMockTenant(tenantId);
    await addOneTenant(tenant);

    const invalidAgreementState = randomArrayItem(
      Object.values(agreementState).filter(
        (s) => !agreementUpgradableStates.includes(s)
      )
    );
    const agreement = getMockAgreement(
      generateId<EServiceId>(),
      tenantId,
      invalidAgreementState
    );

    await addOneAgreement(agreement);
    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement.id, invalidAgreementState)
    );
  });

  it("should throw an eServiceNotFound error when the eservice not exists", async () => {
    const authData = getRandomAuthData();
    const tenantId = authData.organizationId;
    const tenant = getMockTenant(tenantId);
    await addOneTenant(tenant);

    const agreement = {
      ...getMockAgreement(
        generateId<EServiceId>(),
        tenantId,
        randomArrayItem(agreementUpgradableStates)
      ),
    };

    await addOneAgreement(agreement);
    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));
  });

  it("should throw a publishedDescriptorNotFound error when published descriptor not exists", async () => {
    const authData = getRandomAuthData();
    const tenantId = authData.organizationId;
    const tenant = getMockTenant(tenantId);
    await addOneTenant(tenant);

    const agreement = getMockAgreement(
      generateId<EServiceId>(),
      tenantId,
      randomArrayItem(agreementUpgradableStates)
    );
    await addOneAgreement(agreement);

    const deprecated = {
      ...getMockDescriptorPublished(),
      state: descriptorState.deprecated,
    };
    const eservice = getMockEService(agreement.eserviceId, tenantId, [
      deprecated,
    ]);
    await addOneEService(eservice);

    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(publishedDescriptorNotFound(agreement.eserviceId));
  });

  it("should throw an unexpectedVersionFormat error when published descriptor has unexpected version format", async () => {
    const authData = getRandomAuthData();
    const tenantId = authData.organizationId;
    const tenant = getMockTenant(tenantId);
    await addOneTenant(tenant);

    const agreement = {
      ...getMockAgreement(
        generateId<EServiceId>(),
        tenantId,
        randomArrayItem(agreementUpgradableStates)
      ),
    };
    await addOneAgreement(agreement);

    const publishedDescriptor = {
      ...getMockDescriptorPublished(),
      version: "invalid-version-number",
    };
    const eservice = getMockEService(agreement.eserviceId, tenantId, [
      publishedDescriptor,
    ]);
    await addOneEService(eservice);

    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      unexpectedVersionFormat(agreement.eserviceId, publishedDescriptor.id)
    );
  });

  it("should throw a descriptorNotFound error when agreement descriptor not exists", async () => {
    const authData = getRandomAuthData();
    const tenantId = authData.organizationId;
    const tenant = getMockTenant(tenantId);
    await addOneTenant(tenant);

    const agreement = getMockAgreement(
      generateId<EServiceId>(),
      tenantId,
      randomArrayItem(agreementUpgradableStates)
    );
    await addOneAgreement(agreement);

    const publishedDescriptor = {
      ...getMockDescriptorPublished(),
      version: "1",
    };
    const eservice = getMockEService(agreement.eserviceId, tenantId, [
      publishedDescriptor,
    ]);
    await addOneEService(eservice);

    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      descriptorNotFound(eservice.id, agreement.descriptorId)
    );
  });

  it("should throw an unexpectedVersionFormat error when agreement descriptor has invalid format", async () => {
    const authData = getRandomAuthData();
    const tenantId = authData.organizationId;
    const tenant = getMockTenant(tenantId);
    await addOneTenant(tenant);

    const publishedDescriptor = {
      ...getMockDescriptorPublished(),
      id: generateId<DescriptorId>(),
      version: "1",
    };
    const deprecatedDescriptor = {
      ...getMockDescriptorPublished(),
      id: generateId<DescriptorId>(),
      state: descriptorState.deprecated,
      version: "invalid-version-number",
    };

    const agreement = {
      ...getMockAgreement(
        generateId<EServiceId>(),
        tenantId,
        randomArrayItem(agreementUpgradableStates)
      ),
      descriptorId: deprecatedDescriptor.id,
    };
    await addOneAgreement(agreement);

    const eservice = getMockEService(agreement.eserviceId, tenantId, [
      publishedDescriptor,
      deprecatedDescriptor,
    ]);
    await addOneEService(eservice);

    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      unexpectedVersionFormat(eservice.id, agreement.descriptorId)
    );
  });

  it("should throw a noNewerDescriptor error when the latest published descriptor have version number greater than agreement's descriptor", async () => {
    const authData = getRandomAuthData();
    const tenantId = authData.organizationId;
    const tenant = getMockTenant(tenantId);
    await addOneTenant(tenant);

    const publishedDescriptor = {
      ...getMockDescriptorPublished(),
      id: generateId<DescriptorId>(),
      version: "2",
    };
    const deprecatedDescriptor = {
      ...getMockDescriptorPublished(),
      id: generateId<DescriptorId>(),
      state: descriptorState.deprecated,
      version: "1",
    };

    const agreement = {
      ...getMockAgreement(
        generateId<EServiceId>(),
        tenantId,
        randomArrayItem(agreementUpgradableStates)
      ),
      descriptorId: publishedDescriptor.id,
    };
    await addOneAgreement(agreement);

    const eservice = getMockEService(agreement.eserviceId, tenantId, [
      publishedDescriptor,
      deprecatedDescriptor,
    ]);
    await addOneEService(eservice);

    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      noNewerDescriptor(eservice.id, agreement.descriptorId)
    );
  });

  it("should throw a missingCertifiedAttributesError error when consumer and producer are different and published descriptor has invalid certified attributes", async () => {
    const authData = getRandomAuthData();
    const tenantId = authData.organizationId;

    const invalidCertifiedTenantAttribute = {
      ...getMockCertifiedTenantAttribute(),
      revocationTimestamp: new Date(),
    };

    const invalidCertifiedEserviceAttribute = getMockEServiceAttribute(
      invalidCertifiedTenantAttribute.id
    );

    const tenant = {
      ...getMockTenant(tenantId),
      attributes: [invalidCertifiedTenantAttribute],
    };
    await addOneTenant(tenant);

    const publishedDescriptor = {
      ...getMockDescriptorPublished(generateId<DescriptorId>(), [
        [invalidCertifiedEserviceAttribute],
      ]),
      version: "2",
    };

    const deprecatedDescriptor = {
      ...getMockDescriptorPublished(),
      id: generateId<DescriptorId>(),
      state: descriptorState.deprecated,
      version: "1",
    };

    // producer is different from consumer, so that certified attributes are checked
    const producerId = generateId<TenantId>();
    const agreement = {
      ...getMockAgreement(
        generateId<EServiceId>(),
        tenantId,
        randomArrayItem(agreementUpgradableStates)
      ),
      descriptorId: deprecatedDescriptor.id,
      producerId,
    };
    await addOneAgreement(agreement);

    const eservice = getMockEService(agreement.eserviceId, producerId, [
      publishedDescriptor,
      deprecatedDescriptor,
    ]);
    await addOneEService(eservice);

    await expect(
      agreementService.upgradeAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      missingCertifiedAttributesError(publishedDescriptor.id, tenantId)
    );
  });

  it("should throw a FileManagerError error when document copy fails", async () => {
    const authData = getRandomAuthData();
    const tenantId = authData.organizationId;
    const descriptorId = generateId<DescriptorId>();

    const agreementId = generateId<AgreementId>();
    const agreementConsumerDocument = getMockConsumerDocument(agreementId);
    const agreementSubject = {
      ...getMockAgreement(
        generateId<EServiceId>(),
        generateId<TenantId>(),
        randomArrayItem(agreementUpgradableStates)
      ),
      id: agreementId,
      consumerDocuments: [agreementConsumerDocument],
    };

    const validVerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: tenantId,
          verificationDate: new Date(TEST_EXECUTION_DATE.getFullYear() - 1),
          expirationDate: new Date(TEST_EXECUTION_DATE.getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
    };

    const validVerifiedEserviceAttribute = getMockEServiceAttribute(
      validVerifiedTenantAttribute.id
    );

    const invalidDeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: new Date(TEST_EXECUTION_DATE.getFullYear() + 1),
    };

    const invalidDeclaredEserviceAttribute = getMockEServiceAttribute(
      invalidDeclaredTenantAttribute.id
    );

    const tenant = getMockTenant(tenantId, [
      validVerifiedTenantAttribute,
      invalidDeclaredTenantAttribute,
    ]);
    await addOneTenant(tenant);

    const deprecatedDescriptor = {
      ...getMockDescriptorPublished(
        descriptorId,
        [],
        [[invalidDeclaredEserviceAttribute]],
        [[validVerifiedEserviceAttribute]]
      ),
      name: "deprecated-descriptor-doc",
      state: descriptorState.deprecated,
      version: "1",
    };

    const publishedDescriptor = {
      ...getMockDescriptorPublished(
        descriptorId,
        [],
        [[invalidDeclaredEserviceAttribute]],
        [[validVerifiedEserviceAttribute]]
      ),
      version: "2",
    };

    const agreementToBeUpgraded: Agreement = {
      ...agreementSubject,
      descriptorId,
      producerId: tenantId,
      consumerId: tenantId,
      stamps: {},
      createdAt: TEST_EXECUTION_DATE,
      consumerDocuments: [agreementConsumerDocument],
    };

    await addOneAgreement(agreementToBeUpgraded);

    const eservice: EService = getMockEService(
      agreementToBeUpgraded.eserviceId,
      tenant.id,
      [deprecatedDescriptor, publishedDescriptor]
    );
    await addOneEService(eservice);

    // trying to copy a document not present in the S3 bucket - no upload was performed
    await expect(
      agreementService.upgradeAgreement(agreementToBeUpgraded.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(FileManagerError);
  });

  it("should throw an agreementAlreadyExists error when found a draft conflicting agreement with same consumer and e-service", async () => {
    const authData = getRandomAuthData();
    const tenantId = authData.organizationId;
    const descriptorId = generateId<DescriptorId>();

    const agreementSubject = getMockAgreement(
      generateId<EServiceId>(),
      generateId<TenantId>(),
      randomArrayItem(agreementUpgradableStates)
    );

    const validVerifiedTenantAttribute = {
      ...getMockVerifiedTenantAttribute(),
      verifiedBy: [
        {
          id: tenantId,
          verificationDate: new Date(TEST_EXECUTION_DATE.getFullYear() - 1),
          expirationDate: new Date(TEST_EXECUTION_DATE.getFullYear() + 1),
          extensionDate: undefined,
        },
      ],
    };

    const validVerifiedEserviceAttribute = getMockEServiceAttribute(
      validVerifiedTenantAttribute.id
    );

    const invalidDeclaredTenantAttribute = {
      ...getMockDeclaredTenantAttribute(),
      revocationTimestamp: new Date(TEST_EXECUTION_DATE.getFullYear() + 1),
    };

    const invalidDeclaredEserviceAttribute = getMockEServiceAttribute(
      invalidDeclaredTenantAttribute.id
    );

    const tenant = getMockTenant(tenantId, [
      validVerifiedTenantAttribute,
      invalidDeclaredTenantAttribute,
    ]);
    await addOneTenant(tenant);

    const deprecatedDescriptor = {
      ...getMockDescriptorPublished(
        descriptorId,
        [],
        [[invalidDeclaredEserviceAttribute]],
        [[validVerifiedEserviceAttribute]]
      ),
      name: "deprecated-descriptor-doc",
      state: descriptorState.deprecated,
      version: "1",
    };

    const publishedDescriptor = {
      ...getMockDescriptorPublished(
        descriptorId,
        [],
        [[invalidDeclaredEserviceAttribute]],
        [[validVerifiedEserviceAttribute]]
      ),
      version: "2",
    };

    const agreementToBeUpgraded: Agreement = {
      ...agreementSubject,
      descriptorId,
      producerId: tenantId,
      consumerId: tenantId,
      stamps: {},
      createdAt: TEST_EXECUTION_DATE,
    };
    const agreementAlreadyExist = {
      ...agreementToBeUpgraded,
      id: generateId<AgreementId>(),
      state: agreementState.draft,
    };

    await addOneAgreement(agreementToBeUpgraded);
    await addOneAgreement(agreementAlreadyExist);

    const eservice: EService = getMockEService(
      agreementToBeUpgraded.eserviceId,
      tenant.id,
      [deprecatedDescriptor, publishedDescriptor]
    );
    await addOneEService(eservice);

    await expect(
      agreementService.upgradeAgreement(agreementToBeUpgraded.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(
      agreementAlreadyExists(
        agreementToBeUpgraded.consumerId,
        agreementToBeUpgraded.eserviceId
      )
    );
  });
});
