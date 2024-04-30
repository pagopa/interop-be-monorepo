/* eslint-disable functional/no-let */
/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable fp/no-delete */
/* eslint-disable functional/immutable-data */
import { fail } from "assert";
import { FileManagerError } from "pagopa-interop-commons";
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
  readEventByStreamIdAndVersion,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementAddedV1,
  AgreementConsumerDocumentAddedV1,
  AgreementDocumentId,
  AgreementId,
  AgreementUpdatedV1,
  AgreementV1,
  Descriptor,
  DescriptorId,
  EService,
  EServiceId,
  TenantId,
  agreementState,
  descriptorState,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
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
  tenantIdNotFound,
  unexpectedVersionFormat,
} from "../src/model/domain/errors.js";
import {
  toAgreementDocumentV1,
  toAgreementV1,
} from "../src/model/domain/toEvent.js";
import { agreementUpgradableStates } from "../src/model/domain/validators.js";
import { config } from "../src/utilities/config.js";
import {
  agreementService,
  agreements,
  eservices,
  fileManager,
  postgresDB,
  tenants,
} from "./agreementService.integration.test.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  getMockConsumerDocument,
  readAgreementEventByVersion,
  readLastAgreementEvent,
} from "./utils.js";

export const testUpgradeAgreement = (): ReturnType<typeof describe> =>
  describe("Upgrade Agreement", () => {
    const TEST_EXECUTION_DATE = new Date();

    beforeAll(() => {
      vi.useFakeTimers();
      vi.setSystemTime(TEST_EXECUTION_DATE);
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    async function uploadDocument(
      agreementId: AgreementId,
      documentId: AgreementDocumentId,
      name: string
    ): Promise<void> {
      const documentDestinationPath = `${config.consumerDocumentsPath}/${agreementId}`;
      await fileManager.storeBytes(
        config.s3Bucket,
        documentDestinationPath,
        documentId,
        name,
        Buffer.from("large-document-file")
      );
      expect(await fileManager.listFiles(config.s3Bucket)).toContainEqual(
        `${config.consumerDocumentsPath}/${agreementId}/${documentId}/${name}`
      );
    }

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

      await addOneEService(eservice, eservices);
      await addOneTenant(producerAndConsumer, tenants);
      await addOneAgreement(agreementToBeUpgraded, postgresDB, agreements);

      const newAgreementId = unsafeBrandId<AgreementId>(
        await agreementService.upgradeAgreement(
          agreementToBeUpgraded.id,
          authData,
          uuidv4()
        )
      );

      const actualAgreementArchivedEvent = await readAgreementEventByVersion(
        agreementToBeUpgraded.id,
        1,
        postgresDB
      );

      expect(actualAgreementArchivedEvent).toMatchObject({
        type: "AgreementUpdated",
        event_version: 1,
        version: "1",
        stream_id: agreementToBeUpgraded.id,
      });

      const actualAgreementArchived = decodeProtobufPayload({
        messageType: AgreementUpdatedV1,
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
        toAgreementV1(expectedAgreementArchived)
      );

      expect(newAgreementId).toBeDefined();

      const actualAgreementCreatedEvent = await readAgreementEventByVersion(
        newAgreementId,
        0,
        postgresDB
      );

      expect(actualAgreementCreatedEvent).toMatchObject({
        type: "AgreementAdded",
        event_version: 1,
        version: "0",
        stream_id: newAgreementId,
      });

      const actualAgreementCreated: AgreementV1 | undefined =
        decodeProtobufPayload({
          messageType: AgreementAddedV1,
          payload: actualAgreementCreatedEvent.data,
        }).agreement;

      const expectedCreatedAgreement = toAgreementV1({
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
      });

      // The method toAgreementV1 sets these to undefined,
      // while when we read the event data they are not present
      delete expectedCreatedAgreement.updatedAt;
      delete expectedCreatedAgreement.rejectionReason;
      expect(actualAgreementCreated).toMatchObject(expectedCreatedAgreement);

      for (let index = 0; index < agreementConsumerDocuments.length; index++) {
        const agreementConsumerDocument = agreementConsumerDocuments[index];
        const currentVersion = index + 1;
        const actualAgreementDocumentAddedEvent =
          await readEventByStreamIdAndVersion(
            newAgreementId,
            currentVersion,
            "agreement",
            postgresDB
          );

        expect(actualAgreementDocumentAddedEvent).toMatchObject({
          type: "AgreementConsumerDocumentAdded",
          event_version: 1,
          version: currentVersion.toString(),
          stream_id: newAgreementId,
        });

        const actualAgreementDocumentAdded = decodeProtobufPayload({
          messageType: AgreementConsumerDocumentAddedV1,
          payload: actualAgreementDocumentAddedEvent.data,
        }).document;

        expect(actualAgreementDocumentAdded).toBeDefined();
        if (!actualAgreementDocumentAdded) {
          fail("Document not found in event");
        }
        const expectedUploadedDocumentPath = `${config.consumerDocumentsPath}/${newAgreementId}/${actualAgreementDocumentAdded.id}/${agreementConsumerDocument.name}`;

        const expectedCreatedDocument = {
          id: unsafeBrandId<AgreementDocumentId>(
            actualAgreementDocumentAdded.id
          ),
          name: agreementConsumerDocument.name,
          prettyName: agreementConsumerDocument.prettyName,
          contentType: agreementConsumerDocument.contentType,
          path: expectedUploadedDocumentPath,
          createdAt: TEST_EXECUTION_DATE,
        };

        expect(actualAgreementDocumentAdded).toMatchObject(
          toAgreementDocumentV1(expectedCreatedDocument)
        );

        expect(await fileManager.listFiles(config.s3Bucket)).toContainEqual(
          expectedUploadedDocumentPath
        );
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

      await addOneEService(eservice, eservices);
      await addOneTenant(consumer, tenants);
      await addOneAgreement(agreementToBeUpgraded, postgresDB, agreements);

      const newAgreementId = unsafeBrandId<AgreementId>(
        await agreementService.upgradeAgreement(
          agreementToBeUpgraded.id,
          authData,
          uuidv4()
        )
      );

      const actualAgreementArchivedEvent = await readAgreementEventByVersion(
        agreementToBeUpgraded.id,
        1,
        postgresDB
      );

      expect(actualAgreementArchivedEvent).toMatchObject({
        type: "AgreementUpdated",
        event_version: 1,
        version: "1",
        stream_id: agreementToBeUpgraded.id,
      });

      const actualAgreementArchived = decodeProtobufPayload({
        messageType: AgreementUpdatedV1,
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
        toAgreementV1(expectedAgreementArchived)
      );

      expect(newAgreementId).toBeDefined();

      const actualAgreementCreatedEvent = await readAgreementEventByVersion(
        newAgreementId,
        0,
        postgresDB
      );

      expect(actualAgreementCreatedEvent).toMatchObject({
        type: "AgreementAdded",
        event_version: 1,
        version: "0",
        stream_id: newAgreementId,
      });

      const actualAgreementCreated: AgreementV1 | undefined =
        decodeProtobufPayload({
          messageType: AgreementAddedV1,
          payload: actualAgreementCreatedEvent.data,
        }).agreement;

      const expectedCreatedAgreement = toAgreementV1({
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
      });

      // The method toAgreementV1 sets these to undefined,
      // while when we read the event data they are not present
      delete expectedCreatedAgreement.updatedAt;
      delete expectedCreatedAgreement.rejectionReason;
      expect(actualAgreementCreated).toMatchObject(expectedCreatedAgreement);

      expect(await fileManager.listFiles(config.s3Bucket)).toContainEqual(
        expectedCreatedAgreement.consumerDocuments[0].path
      );

      const actualAgreementConsumerDocumentEvent =
        await readAgreementEventByVersion(newAgreementId, 1, postgresDB);

      expect(actualAgreementConsumerDocumentEvent).toMatchObject({
        type: "AgreementConsumerDocumentAdded",
        event_version: 1,
        version: "1",
        stream_id: newAgreementId,
      });
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
      await addOneTenant(tenant, tenants);

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

      await addOneAgreement(agreementToBeUpgraded, postgresDB, agreements);

      const eservice: EService = getMockEService(
        agreementToBeUpgraded.eserviceId,
        tenant.id,
        [deprecatedDescriptor, publishedDescriptor]
      );
      await addOneEService(eservice, eservices);

      const newAgreementId = unsafeBrandId<AgreementId>(
        await agreementService.upgradeAgreement(
          agreementToBeUpgraded.id,
          authData,
          uuidv4()
        )
      );

      expect(newAgreementId).toBeDefined();

      const actualAgreementCreatedEvent = await readAgreementEventByVersion(
        newAgreementId,
        0,
        postgresDB
      );

      expect(actualAgreementCreatedEvent).toMatchObject({
        type: "AgreementAdded",
        event_version: 1,
        version: "0",
        stream_id: newAgreementId,
      });

      const actualCreatedAgreementV1 = decodeProtobufPayload({
        messageType: AgreementAddedV1,
        payload: actualAgreementCreatedEvent.data,
      }).agreement;

      const expectedCreatedAgreement = toAgreementV1({
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
        consumerDocuments: [],
        stamps: {},
      });

      expectedCreatedAgreement.stamps = {};
      delete expectedCreatedAgreement.updatedAt;
      delete expectedCreatedAgreement.suspendedAt;
      delete expectedCreatedAgreement.contract;
      expect(actualCreatedAgreementV1).toMatchObject(expectedCreatedAgreement);

      const actualAgreementDocumentAddedEvent = await readLastAgreementEvent(
        newAgreementId,
        postgresDB
      );

      expect(actualAgreementDocumentAddedEvent).toMatchObject({
        type: "AgreementConsumerDocumentAdded",
        event_version: 1,
        version: "1",
        stream_id: newAgreementId,
      });

      const actualAgreementDocumentAdded = decodeProtobufPayload({
        messageType: AgreementConsumerDocumentAddedV1,
        payload: actualAgreementDocumentAddedEvent.data,
      }).document;

      expect(actualAgreementDocumentAdded).toBeDefined();
      if (!actualAgreementDocumentAdded) {
        fail("Document not found in event");
      }
      const expectedUploadedDocumentPath = `${config.consumerDocumentsPath}/${newAgreementId}/${actualAgreementDocumentAdded.id}/${agreementConsumerDocument.name}`;

      const expectedCreatedDocument = {
        id: unsafeBrandId<AgreementDocumentId>(actualAgreementDocumentAdded.id),
        name: agreementConsumerDocument.name,
        prettyName: agreementConsumerDocument.prettyName,
        contentType: agreementConsumerDocument.contentType,
        path: expectedUploadedDocumentPath,
        createdAt: TEST_EXECUTION_DATE,
      };
      expect(actualAgreementDocumentAdded).toMatchObject(
        toAgreementDocumentV1(expectedCreatedDocument)
      );

      expect(await fileManager.listFiles(config.s3Bucket)).toContainEqual(
        expectedUploadedDocumentPath
      );
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
      await addOneTenant(tenant, tenants);

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

      await addOneAgreement(agreementToBeUpgraded, postgresDB, agreements);

      const eservice: EService = getMockEService(
        agreementToBeUpgraded.eserviceId,
        tenant.id,
        [deprecatedDescriptor, publishedDescriptor]
      );
      await addOneEService(eservice, eservices);

      const newAgreementId = unsafeBrandId<AgreementId>(
        await agreementService.upgradeAgreement(
          agreementToBeUpgraded.id,
          authData,
          uuidv4()
        )
      );

      expect(newAgreementId).toBeDefined();
      const actualAgreementCreatedEvent = await readAgreementEventByVersion(
        newAgreementId,
        0,
        postgresDB
      );

      expect(actualAgreementCreatedEvent).toMatchObject({
        type: "AgreementAdded",
        event_version: 1,
        version: "0",
        stream_id: newAgreementId,
      });

      const actualCreatedAgreement = decodeProtobufPayload({
        messageType: AgreementAddedV1,
        payload: actualAgreementCreatedEvent.data,
      }).agreement;

      const expectedCreatedAgreement = toAgreementV1({
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
        consumerDocuments: [],
        stamps: {},
      });

      expectedCreatedAgreement.stamps = {};
      delete expectedCreatedAgreement.updatedAt;
      delete expectedCreatedAgreement.suspendedAt;
      delete expectedCreatedAgreement.contract;
      expect(actualCreatedAgreement).toMatchObject(expectedCreatedAgreement);

      const actualAgreementDocumentAddedEvent = await readLastAgreementEvent(
        newAgreementId,
        postgresDB
      );

      expect(actualAgreementDocumentAddedEvent).toMatchObject({
        type: "AgreementConsumerDocumentAdded",
        event_version: 1,
        version: "1",
        stream_id: newAgreementId,
      });

      const actualAgreementDocumentAdded = decodeProtobufPayload({
        messageType: AgreementConsumerDocumentAddedV1,
        payload: actualAgreementDocumentAddedEvent.data,
      }).document;

      expect(actualAgreementDocumentAdded).toBeDefined();
      if (!actualAgreementDocumentAdded) {
        fail("Document not found in event");
      }
      const expectedUploadedDocumentPath = `${config.consumerDocumentsPath}/${newAgreementId}/${actualAgreementDocumentAdded.id}/${agreementConsumerDocument.name}`;

      const expectedCreatedDocument = {
        id: unsafeBrandId<AgreementDocumentId>(actualAgreementDocumentAdded.id),
        name: agreementConsumerDocument.name,
        prettyName: agreementConsumerDocument.prettyName,
        contentType: agreementConsumerDocument.contentType,
        path: expectedUploadedDocumentPath,
        createdAt: TEST_EXECUTION_DATE,
      };

      expect(actualAgreementDocumentAdded).toMatchObject(
        toAgreementDocumentV1(expectedCreatedDocument)
      );

      expect(await fileManager.listFiles(config.s3Bucket)).toContainEqual(
        expectedUploadedDocumentPath
      );
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
      await addOneTenant(tenant, tenants);

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

      await addOneAgreement(agreementToBeUpgraded, postgresDB, agreements);

      const eservice: EService = getMockEService(
        agreementToBeUpgraded.eserviceId,
        tenant.id,
        [deprecatedDescriptor, publishedDescriptor]
      );
      await addOneEService(eservice, eservices);

      const newAgreementId = unsafeBrandId<AgreementId>(
        await agreementService.upgradeAgreement(
          agreementToBeUpgraded.id,
          authData,
          uuidv4()
        )
      );

      expect(newAgreementId).toBeDefined();
      const actualAgreementCreatedEvent = await readAgreementEventByVersion(
        newAgreementId,
        0,
        postgresDB
      );

      expect(actualAgreementCreatedEvent).toMatchObject({
        type: "AgreementAdded",
        event_version: 1,
        version: "0",
        stream_id: newAgreementId,
      });

      const actualCreatedAgreement = decodeProtobufPayload({
        messageType: AgreementAddedV1,
        payload: actualAgreementCreatedEvent.data,
      }).agreement;

      const expectedCreatedAgreement = toAgreementV1({
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
        consumerDocuments: [],
        stamps: {},
      });

      expectedCreatedAgreement.stamps = {};
      delete expectedCreatedAgreement.updatedAt;
      delete expectedCreatedAgreement.suspendedAt;
      delete expectedCreatedAgreement.contract;
      expect(actualCreatedAgreement).toMatchObject(expectedCreatedAgreement);

      // The following assertions verify the "AgreementConsumerDocumentAdded" event for each document
      for (let index = 0; index < agreementConsumerDocuments.length; index++) {
        const agreementConsumerDocument = agreementConsumerDocuments[index];
        const currentVersion = index + 1;
        const actualAgreementDocumentAddedEvent =
          await readEventByStreamIdAndVersion(
            newAgreementId,
            currentVersion,
            "agreement",
            postgresDB
          );

        expect(actualAgreementDocumentAddedEvent).toMatchObject({
          type: "AgreementConsumerDocumentAdded",
          event_version: 1,
          version: currentVersion.toString(),
          stream_id: newAgreementId,
        });

        const actualAgreementDocumentAdded = decodeProtobufPayload({
          messageType: AgreementConsumerDocumentAddedV1,
          payload: actualAgreementDocumentAddedEvent.data,
        }).document;

        expect(actualAgreementDocumentAdded).toBeDefined();
        if (!actualAgreementDocumentAdded) {
          fail("Document not found in event");
        }
        const expectedUploadedDocumentPath = `${config.consumerDocumentsPath}/${newAgreementId}/${actualAgreementDocumentAdded.id}/${agreementConsumerDocument.name}`;

        const expectedCreatedDocument = {
          id: unsafeBrandId<AgreementDocumentId>(
            actualAgreementDocumentAdded.id
          ),
          name: agreementConsumerDocument.name,
          prettyName: agreementConsumerDocument.prettyName,
          contentType: agreementConsumerDocument.contentType,
          path: expectedUploadedDocumentPath,
          createdAt: TEST_EXECUTION_DATE,
        };

        expect(actualAgreementDocumentAdded).toMatchObject(
          toAgreementDocumentV1(expectedCreatedDocument)
        );

        expect(await fileManager.listFiles(config.s3Bucket)).toContainEqual(
          expectedUploadedDocumentPath
        );
      }
    });

    it("should throw a tenantIdNotFound error when the tenant does not exist", async () => {
      const authData = getRandomAuthData();
      const agreementId = generateId<AgreementId>();
      await expect(
        agreementService.upgradeAgreement(agreementId, authData, uuidv4())
      ).rejects.toThrowError(tenantIdNotFound(authData.organizationId));
    });

    it("should throw an agreementNotFound error when the agreement does not exist", async () => {
      const authData = getRandomAuthData();
      const agreementId = generateId<AgreementId>();

      const tenantId = authData.organizationId;
      const tenant = getMockTenant(tenantId);

      await addOneTenant(tenant, tenants);
      await expect(
        agreementService.upgradeAgreement(agreementId, authData, uuidv4())
      ).rejects.toThrowError(agreementNotFound(agreementId));
    });

    it("should throw an operationNotAllowed error when the requester is different from consumer", async () => {
      const authData = getRandomAuthData();
      const tenantId = authData.organizationId;
      const tenant = getMockTenant(tenantId);
      await addOneTenant(tenant, tenants);

      const agreement = getMockAgreement(
        generateId<EServiceId>(),
        generateId<TenantId>(),
        randomArrayItem(agreementUpgradableStates)
      );

      await addOneAgreement(agreement, postgresDB, agreements);
      await expect(
        agreementService.upgradeAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
    });

    it("should throw an agreementNotInExpectedState error when the agreement doesn't have an upgradable states", async () => {
      const authData = getRandomAuthData();
      const tenantId = authData.organizationId;
      const tenant = getMockTenant(tenantId);
      await addOneTenant(tenant, tenants);

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

      await addOneAgreement(agreement, postgresDB, agreements);
      await expect(
        agreementService.upgradeAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(
        agreementNotInExpectedState(agreement.id, invalidAgreementState)
      );
    });

    it("should throw an eServiceNotFound error when the eservice not exists", async () => {
      const authData = getRandomAuthData();
      const tenantId = authData.organizationId;
      const tenant = getMockTenant(tenantId);
      await addOneTenant(tenant, tenants);

      const agreement = {
        ...getMockAgreement(
          generateId<EServiceId>(),
          tenantId,
          randomArrayItem(agreementUpgradableStates)
        ),
      };

      await addOneAgreement(agreement, postgresDB, agreements);
      await expect(
        agreementService.upgradeAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));
    });

    it("should throw a publishedDescriptorNotFound error when published descriptor not exists", async () => {
      const authData = getRandomAuthData();
      const tenantId = authData.organizationId;
      const tenant = getMockTenant(tenantId);
      await addOneTenant(tenant, tenants);

      const agreement = getMockAgreement(
        generateId<EServiceId>(),
        tenantId,
        randomArrayItem(agreementUpgradableStates)
      );
      await addOneAgreement(agreement, postgresDB, agreements);

      const deprecated = {
        ...getMockDescriptorPublished(),
        state: descriptorState.deprecated,
      };
      const eservice = getMockEService(agreement.eserviceId, tenantId, [
        deprecated,
      ]);
      await addOneEService(eservice, eservices);

      await expect(
        agreementService.upgradeAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(publishedDescriptorNotFound(agreement.eserviceId));
    });

    it("should throw an unexpectedVersionFormat error when published descriptor has unexpected version format", async () => {
      const authData = getRandomAuthData();
      const tenantId = authData.organizationId;
      const tenant = getMockTenant(tenantId);
      await addOneTenant(tenant, tenants);

      const agreement = {
        ...getMockAgreement(
          generateId<EServiceId>(),
          tenantId,
          randomArrayItem(agreementUpgradableStates)
        ),
      };
      await addOneAgreement(agreement, postgresDB, agreements);

      const publishedDescriptor = {
        ...getMockDescriptorPublished(),
        version: "invalid-version-number",
      };
      const eservice = getMockEService(agreement.eserviceId, tenantId, [
        publishedDescriptor,
      ]);
      await addOneEService(eservice, eservices);

      await expect(
        agreementService.upgradeAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(
        unexpectedVersionFormat(agreement.eserviceId, publishedDescriptor.id)
      );
    });

    it("should throw a descriptorNotFound error when agreement descriptor not exists", async () => {
      const authData = getRandomAuthData();
      const tenantId = authData.organizationId;
      const tenant = getMockTenant(tenantId);
      await addOneTenant(tenant, tenants);

      const agreement = getMockAgreement(
        generateId<EServiceId>(),
        tenantId,
        randomArrayItem(agreementUpgradableStates)
      );
      await addOneAgreement(agreement, postgresDB, agreements);

      const publishedDescriptor = {
        ...getMockDescriptorPublished(),
        version: "1",
      };
      const eservice = getMockEService(agreement.eserviceId, tenantId, [
        publishedDescriptor,
      ]);
      await addOneEService(eservice, eservices);

      await expect(
        agreementService.upgradeAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(
        descriptorNotFound(eservice.id, agreement.descriptorId)
      );
    });

    it("should throw an unexpectedVersionFormat error when agreement descriptor has invalid format", async () => {
      const authData = getRandomAuthData();
      const tenantId = authData.organizationId;
      const tenant = getMockTenant(tenantId);
      await addOneTenant(tenant, tenants);

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
      await addOneAgreement(agreement, postgresDB, agreements);

      const eservice = getMockEService(agreement.eserviceId, tenantId, [
        publishedDescriptor,
        deprecatedDescriptor,
      ]);
      await addOneEService(eservice, eservices);

      await expect(
        agreementService.upgradeAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(
        unexpectedVersionFormat(eservice.id, agreement.descriptorId)
      );
    });

    it("should throw a noNewerDescriptor error when the latest published descriptor have version number greater than agreement's descriptor", async () => {
      const authData = getRandomAuthData();
      const tenantId = authData.organizationId;
      const tenant = getMockTenant(tenantId);
      await addOneTenant(tenant, tenants);

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
      await addOneAgreement(agreement, postgresDB, agreements);

      const eservice = getMockEService(agreement.eserviceId, tenantId, [
        publishedDescriptor,
        deprecatedDescriptor,
      ]);
      await addOneEService(eservice, eservices);

      await expect(
        agreementService.upgradeAgreement(agreement.id, authData, uuidv4())
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
      await addOneTenant(tenant, tenants);

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
      await addOneAgreement(agreement, postgresDB, agreements);

      const eservice = getMockEService(agreement.eserviceId, producerId, [
        publishedDescriptor,
        deprecatedDescriptor,
      ]);
      await addOneEService(eservice, eservices);

      await expect(
        agreementService.upgradeAgreement(agreement.id, authData, uuidv4())
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
      await addOneTenant(tenant, tenants);

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

      await addOneAgreement(agreementToBeUpgraded, postgresDB, agreements);

      const eservice: EService = getMockEService(
        agreementToBeUpgraded.eserviceId,
        tenant.id,
        [deprecatedDescriptor, publishedDescriptor]
      );
      await addOneEService(eservice, eservices);

      // trying to copy a document not present in the S3 bucket - no upload was performed
      await expect(
        agreementService.upgradeAgreement(
          agreementToBeUpgraded.id,
          authData,
          uuidv4()
        )
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
      await addOneTenant(tenant, tenants);

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

      await addOneAgreement(agreementToBeUpgraded, postgresDB, agreements);
      await addOneAgreement(agreementAlreadyExist, postgresDB, agreements);

      const eservice: EService = getMockEService(
        agreementToBeUpgraded.eserviceId,
        tenant.id,
        [deprecatedDescriptor, publishedDescriptor]
      );
      await addOneEService(eservice, eservices);

      await expect(
        agreementService.upgradeAgreement(
          agreementToBeUpgraded.id,
          authData,
          uuidv4()
        )
      ).rejects.toThrowError(
        agreementAlreadyExists(
          agreementToBeUpgraded.consumerId,
          agreementToBeUpgraded.eserviceId
        )
      );
    });
  });
