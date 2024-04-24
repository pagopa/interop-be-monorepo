/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable fp/no-delete */
/* eslint-disable functional/immutable-data */
import { fail } from "assert";
import { generateMock } from "@anatine/zod-mock";
import { FileManagerError, userRoles } from "pagopa-interop-commons";
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
  AgreementAddedV1,
  AgreementConsumerDocumentAddedV1,
  AgreementDocumentId,
  AgreementId,
  AgreementUpdatedV1,
  AgreementV1,
  AttributeId,
  Descriptor,
  DescriptorId,
  Document,
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

    async function uploadDocument(path: string, name: string): Promise<void> {
      await fileManager.storeBytes(
        config.s3Bucket,
        config.consumerDocumentsPath,
        path,
        name,
        Buffer.from("large-document-file")
      );
      expect(await fileManager.listFiles(config.s3Bucket)).toContainEqual(
        `${config.consumerDocumentsPath}/${path}/${name}`
      );
    }

    it("should succeed with valid Verified and Declared attributes", async () => {
      const authData = {
        ...getRandomAuthData(),
        userRoles: [userRoles.ADMIN_ROLE],
      };
      const tenantId = authData.organizationId.toString();

      const validVerifiedTenantAttribute = {
        ...getMockVerifiedTenantAttribute(unsafeBrandId<AttributeId>(tenantId)),
        verifiedBy: [
          {
            id: unsafeBrandId<TenantId>(tenantId),
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
        ...getMockDeclaredTenantAttribute(unsafeBrandId<AttributeId>(tenantId)),
        revocationTimestamp: undefined,
      };
      const validDeclaredEserviceAttribute = getMockEServiceAttribute(
        validDeclaredTenantAttribute.id
      );

      const validCertifiedTenantAttribute = getMockCertifiedTenantAttribute(
        unsafeBrandId<AttributeId>(tenantId)
      );
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
          [[validDeclaredEserviceAttribute]]
        ),
        version: "2",
      };

      const tenant = getMockTenant(unsafeBrandId<TenantId>(tenantId), [
        validCertifiedTenantAttribute,
        validDeclaredTenantAttribute,
        validVerifiedTenantAttribute,
      ]);
      const agreementToBeUpgraded: Agreement = {
        ...getMockAgreement(
          generateId<EServiceId>(),
          unsafeBrandId<TenantId>(tenantId),
          randomArrayItem(agreementUpgradableStates)
        ),
        descriptorId,
        producerId: unsafeBrandId<TenantId>(tenantId),
        createdAt: TEST_EXECUTION_DATE,
      };

      const eservice = getMockEService(
        agreementToBeUpgraded.eserviceId,
        generateId<TenantId>(),
        [deprecatedDescriptor, publishedDescriptor]
      );

      await addOneEService(eservice, eservices);
      await addOneTenant(tenant, tenants);
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

      const actualAgreementCreatedEvent = await readLastAgreementEvent(
        newAgreementId,
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
    });

    it("should succeed with invalid Verified attributes", async () => {
      const authData = {
        ...getRandomAuthData(),
        userRoles: [userRoles.ADMIN_ROLE],
      };
      const tenantId = authData.organizationId.toString();
      const descriptorId = generateId<DescriptorId>();

      const agreementSubject = getMockAgreement(
        generateId<EServiceId>(),
        generateId<TenantId>(),
        randomArrayItem(agreementUpgradableStates)
      );

      const validCertifiedTenantAttribute = getMockCertifiedTenantAttribute(
        unsafeBrandId<AttributeId>(tenantId)
      );
      const validCertifiedEserviceAttribute = getMockEServiceAttribute(
        validCertifiedTenantAttribute.id
      );

      const invalidVerifiedTenantAttribute = {
        ...getMockVerifiedTenantAttribute(),
        verifiedBy: [
          {
            id: unsafeBrandId<TenantId>(tenantId),
            verificationDate: new Date(TEST_EXECUTION_DATE.getFullYear() - 1),
            expirationDate: new Date(TEST_EXECUTION_DATE.getFullYear() + 1),
            extensionDate: undefined,
          },
        ],
      };
      const tenant = getMockTenant(unsafeBrandId<TenantId>(tenantId), [
        invalidVerifiedTenantAttribute,
        validCertifiedTenantAttribute,
      ]);
      await addOneTenant(tenant, tenants);

      const deprecatedDescriptor = {
        ...getMockDescriptorPublished(
          descriptorId,
          [[validCertifiedEserviceAttribute]],
          [],
          [[getMockEServiceAttribute()]]
        ),
        name: "deprecated-descriptor-doc",
        state: descriptorState.deprecated,
        version: "1",
      };

      const documentPublishedDescriptor = {
        ...generateMock(Document),
        name: "published-descriptor-doc",
      };
      const publishedDescriptor = {
        ...getMockDescriptorPublished(
          descriptorId,
          [[validCertifiedEserviceAttribute]],
          [],
          [[getMockEServiceAttribute()]]
        ),
        interface: {
          ...documentPublishedDescriptor,
          name: documentPublishedDescriptor.name,
          path: `${config.consumerDocumentsPath}/${agreementSubject.id}/${descriptorId}/${documentPublishedDescriptor.name}`,
        },
        version: "2",
      };

      await uploadDocument(
        `${agreementSubject.id}/${descriptorId}`,
        documentPublishedDescriptor.name
      );

      const agreementToBeUpgraded: Agreement = {
        ...agreementSubject,
        descriptorId,
        producerId: unsafeBrandId<TenantId>(tenantId),
        consumerId: unsafeBrandId<TenantId>(tenantId),
        stamps: {},
        createdAt: TEST_EXECUTION_DATE,
        consumerDocuments: [
          {
            id: unsafeBrandId<AgreementDocumentId>(
              publishedDescriptor.interface.id
            ),
            name: publishedDescriptor.interface.name,
            prettyName: publishedDescriptor.interface.prettyName,
            contentType: publishedDescriptor.interface.contentType,
            path: publishedDescriptor.interface.path,
            createdAt: publishedDescriptor.interface.uploadDate,
          },
        ],
      };

      await addOneAgreement(agreementToBeUpgraded, postgresDB, agreements);

      const eservice: EService = getMockEService(
        agreementToBeUpgraded.eserviceId,
        generateId<TenantId>(),
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
      const expectedUploadedDocumentPath = `${config.consumerDocumentsPath}/${newAgreementId}/${actualAgreementDocumentAdded.id}/${documentPublishedDescriptor.name}`;

      const expectedCreatedDocument = {
        id: unsafeBrandId<AgreementDocumentId>(actualAgreementDocumentAdded.id),
        name: documentPublishedDescriptor.name,
        prettyName: documentPublishedDescriptor.prettyName,
        contentType: documentPublishedDescriptor.contentType,
        path: expectedUploadedDocumentPath,
        createdAt: TEST_EXECUTION_DATE,
      };
      expect(actualAgreementDocumentAdded).toMatchObject(
        toAgreementDocumentV1(expectedCreatedDocument)
      );
    });

    it("should succeed with invalid Declared attributes", async () => {
      const authData = {
        ...getRandomAuthData(),
        userRoles: [userRoles.ADMIN_ROLE],
      };
      const tenantId = authData.organizationId.toString();
      const descriptorId = generateId<DescriptorId>();

      const agreementSubject = getMockAgreement(
        generateId<EServiceId>(),
        generateId<TenantId>(),
        randomArrayItem(agreementUpgradableStates)
      );

      const validVerifiedTenantAttribute = {
        ...getMockVerifiedTenantAttribute(unsafeBrandId<AttributeId>(tenantId)),
        verifiedBy: [
          {
            id: unsafeBrandId<TenantId>(tenantId),
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
        ...getMockDeclaredTenantAttribute(unsafeBrandId<AttributeId>(tenantId)),
        revocationTimestamp: new Date(TEST_EXECUTION_DATE.getFullYear() + 1),
      };

      const validCertifiedTenantAttribute = getMockCertifiedTenantAttribute(
        unsafeBrandId<AttributeId>(tenantId)
      );
      const validCertifiedEserviceAttribute = getMockEServiceAttribute(
        validCertifiedTenantAttribute.id
      );

      const tenant = getMockTenant(unsafeBrandId<TenantId>(tenantId), [
        validCertifiedTenantAttribute,
        validVerifiedTenantAttribute,
        invalidDeclaredTenantAttribute,
      ]);
      await addOneTenant(tenant, tenants);

      const deprecatedDescriptor = {
        ...getMockDescriptorPublished(
          descriptorId,
          [[validCertifiedEserviceAttribute]],
          [[getMockEServiceAttribute()]],
          [[validVerifiedEserviceAttribute]]
        ),
        name: "deprecated-descriptor-doc",
        state: descriptorState.deprecated,
        version: "1",
      };

      const documentPublishedDescriptor = {
        ...generateMock(Document),
        name: "published-descriptor-doc",
      };
      const publishedDescriptor = {
        ...getMockDescriptorPublished(
          descriptorId,
          [[validCertifiedEserviceAttribute]],
          [[getMockEServiceAttribute()]],
          [[validVerifiedEserviceAttribute]]
        ),
        interface: {
          ...documentPublishedDescriptor,
          name: documentPublishedDescriptor.name,
          path: `${config.consumerDocumentsPath}/${agreementSubject.id}/${descriptorId}/${documentPublishedDescriptor.name}`,
        },
        version: "2",
      };

      await uploadDocument(
        `${agreementSubject.id}/${descriptorId}`,
        documentPublishedDescriptor.name
      );

      const agreementToBeUpgraded: Agreement = {
        ...agreementSubject,
        descriptorId,
        producerId: unsafeBrandId<TenantId>(tenantId),
        consumerId: unsafeBrandId<TenantId>(tenantId),
        stamps: {},
        createdAt: TEST_EXECUTION_DATE,
        consumerDocuments: [
          {
            id: unsafeBrandId<AgreementDocumentId>(
              publishedDescriptor.interface.id
            ),
            name: publishedDescriptor.interface.name,
            prettyName: publishedDescriptor.interface.prettyName,
            contentType: publishedDescriptor.interface.contentType,
            path: publishedDescriptor.interface.path,
            createdAt: publishedDescriptor.interface.uploadDate,
          },
        ],
      };

      await addOneAgreement(agreementToBeUpgraded, postgresDB, agreements);

      const eservice: EService = getMockEService(
        agreementToBeUpgraded.eserviceId,
        generateId<TenantId>(),
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
      const expectedUploadedDocumentPath = `${config.consumerDocumentsPath}/${newAgreementId}/${actualAgreementDocumentAdded.id}/${documentPublishedDescriptor.name}`;

      const expectedCreatedDocument = {
        id: unsafeBrandId<AgreementDocumentId>(actualAgreementDocumentAdded.id),
        name: documentPublishedDescriptor.name,
        prettyName: documentPublishedDescriptor.prettyName,
        contentType: documentPublishedDescriptor.contentType,
        path: expectedUploadedDocumentPath,
        createdAt: TEST_EXECUTION_DATE,
      };

      expect(actualAgreementDocumentAdded).toMatchObject(
        toAgreementDocumentV1(expectedCreatedDocument)
      );
    });

    it("should throw an tenantIdNotFound error when the tenant does not exist", async () => {
      const authData = getRandomAuthData();
      const agreementId = generateId<AgreementId>();
      await expect(
        agreementService.upgradeAgreement(agreementId, authData, uuidv4())
      ).rejects.toThrowError(tenantIdNotFound(authData.organizationId));
    });

    it("should throw an agreementNotFound error when the agreement does not exist", async () => {
      const authData = getRandomAuthData();
      const agreementId = generateId<AgreementId>();

      const tenantId = authData.organizationId.toString();
      const tenant = getMockTenant(unsafeBrandId<TenantId>(tenantId));

      await addOneTenant(tenant, tenants);
      await expect(
        agreementService.upgradeAgreement(agreementId, authData, uuidv4())
      ).rejects.toThrowError(agreementNotFound(agreementId));
    });

    it("should throw an operationNotAllowed error when the requester is different from consumer", async () => {
      const authData = {
        ...getRandomAuthData(),
        userRoles: [userRoles.ADMIN_ROLE],
      };

      const tenantId = unsafeBrandId<TenantId>(authData.organizationId);
      const tenant = getMockTenant(tenantId);
      await addOneTenant(tenant, tenants);

      const agreementId = generateId<AgreementId>();
      const agreement = {
        ...getMockAgreement(
          generateId<EServiceId>(),
          generateId<TenantId>(),
          randomArrayItem(agreementUpgradableStates)
        ),
        id: agreementId,
      };

      await addOneAgreement(agreement, postgresDB, agreements);
      await expect(
        agreementService.upgradeAgreement(agreementId, authData, uuidv4())
      ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
    });

    it("should throw an agreementNotInExpectedState error when the agreement doesn't have an upgradable states", async () => {
      const authData = {
        ...getRandomAuthData(),
        userRoles: [userRoles.ADMIN_ROLE],
      };

      const tenantId = unsafeBrandId<TenantId>(authData.organizationId);
      const tenant = getMockTenant(tenantId);
      await addOneTenant(tenant, tenants);

      const agreementId = generateId<AgreementId>();
      const invalidAgreementState = randomArrayItem(
        Object.values(agreementState).filter(
          (s) => !agreementUpgradableStates.includes(s)
        )
      );
      const agreement = {
        ...getMockAgreement(
          generateId<EServiceId>(),
          tenantId,
          invalidAgreementState
        ),
        id: agreementId,
        state: invalidAgreementState,
      };

      await addOneAgreement(agreement, postgresDB, agreements);
      await expect(
        agreementService.upgradeAgreement(agreementId, authData, uuidv4())
      ).rejects.toThrowError(
        agreementNotInExpectedState(agreementId, invalidAgreementState)
      );
    });

    it("should throw an eServiceNotFound error when the eservice not exists", async () => {
      const authData = {
        ...getRandomAuthData(),
        userRoles: [userRoles.ADMIN_ROLE],
      };

      const tenantId = unsafeBrandId<TenantId>(authData.organizationId);
      const tenant = getMockTenant(tenantId);
      await addOneTenant(tenant, tenants);

      const agreementId = generateId<AgreementId>();
      const agreement = {
        ...getMockAgreement(
          generateId<EServiceId>(),
          tenantId,
          randomArrayItem(agreementUpgradableStates)
        ),
        id: agreementId,
      };

      await addOneAgreement(agreement, postgresDB, agreements);
      await expect(
        agreementService.upgradeAgreement(agreementId, authData, uuidv4())
      ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));
    });

    it("should throw an publishedDescriptorNotFound error when published descriptor not exists", async () => {
      const authData = {
        ...getRandomAuthData(),
        userRoles: [userRoles.ADMIN_ROLE],
      };

      const tenantId = unsafeBrandId<TenantId>(authData.organizationId);
      const tenant = getMockTenant(tenantId);
      await addOneTenant(tenant, tenants);

      const agreementId = generateId<AgreementId>();
      const agreement = {
        ...getMockAgreement(
          generateId<EServiceId>(),
          tenantId,
          randomArrayItem(agreementUpgradableStates)
        ),
        id: agreementId,
      };
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
        agreementService.upgradeAgreement(agreementId, authData, uuidv4())
      ).rejects.toThrowError(publishedDescriptorNotFound(agreement.eserviceId));
    });

    it("should throw an unexpectedVersionFormat error when published descriptor has unexpected version format", async () => {
      const authData = {
        ...getRandomAuthData(),
        userRoles: [userRoles.ADMIN_ROLE],
      };

      const tenantId = unsafeBrandId<TenantId>(authData.organizationId);
      const tenant = getMockTenant(tenantId);
      await addOneTenant(tenant, tenants);

      const agreementId = generateId<AgreementId>();
      const agreement = {
        ...getMockAgreement(
          generateId<EServiceId>(),
          tenantId,
          randomArrayItem(agreementUpgradableStates)
        ),
        id: agreementId,
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
        agreementService.upgradeAgreement(agreementId, authData, uuidv4())
      ).rejects.toThrowError(
        unexpectedVersionFormat(agreement.eserviceId, publishedDescriptor.id)
      );
    });

    it("should throw an descriptorNotFound error when agreement descriptor not exists", async () => {
      const authData = {
        ...getRandomAuthData(),
        userRoles: [userRoles.ADMIN_ROLE],
      };

      const tenantId = unsafeBrandId<TenantId>(authData.organizationId);
      const tenant = getMockTenant(tenantId);
      await addOneTenant(tenant, tenants);

      const agreementId = generateId<AgreementId>();
      const agreement = {
        ...getMockAgreement(
          generateId<EServiceId>(),
          tenantId,
          randomArrayItem(agreementUpgradableStates)
        ),
        id: agreementId,
      };
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
        agreementService.upgradeAgreement(agreementId, authData, uuidv4())
      ).rejects.toThrowError(
        descriptorNotFound(eservice.id, agreement.descriptorId)
      );
    });

    it("should throw an unexpectedVersionFormat error when agreement descriptor has invalid format", async () => {
      const authData = {
        ...getRandomAuthData(),
        userRoles: [userRoles.ADMIN_ROLE],
      };

      const tenantId = unsafeBrandId<TenantId>(authData.organizationId);
      const tenant = getMockTenant(tenantId);
      await addOneTenant(tenant, tenants);

      const agreementId = generateId<AgreementId>();
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
        id: agreementId,
        descriptorId: deprecatedDescriptor.id,
      };
      await addOneAgreement(agreement, postgresDB, agreements);

      const eservice = getMockEService(agreement.eserviceId, tenantId, [
        publishedDescriptor,
        deprecatedDescriptor,
      ]);
      await addOneEService(eservice, eservices);

      await expect(
        agreementService.upgradeAgreement(agreementId, authData, uuidv4())
      ).rejects.toThrowError(
        unexpectedVersionFormat(eservice.id, agreement.descriptorId)
      );
    });

    it("should throw an noNewerDescriptor error when the latest published descriptor have version number great than agreement's descriptor", async () => {
      const authData = {
        ...getRandomAuthData(),
        userRoles: [userRoles.ADMIN_ROLE],
      };

      const tenantId = unsafeBrandId<TenantId>(authData.organizationId);
      const tenant = getMockTenant(tenantId);
      await addOneTenant(tenant, tenants);

      const agreementId = generateId<AgreementId>();
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
        id: agreementId,
        descriptorId: publishedDescriptor.id,
      };
      await addOneAgreement(agreement, postgresDB, agreements);

      const eservice = getMockEService(agreement.eserviceId, tenantId, [
        publishedDescriptor,
        deprecatedDescriptor,
      ]);
      await addOneEService(eservice, eservices);

      await expect(
        agreementService.upgradeAgreement(agreementId, authData, uuidv4())
      ).rejects.toThrowError(
        noNewerDescriptor(eservice.id, agreement.descriptorId)
      );
    });

    it("should throw an missingCertifiedAttributesError error when published descriptor has invalid certified attributes", async () => {
      const authData = {
        ...getRandomAuthData(),
        userRoles: [userRoles.ADMIN_ROLE],
      };

      const tenantId = unsafeBrandId<TenantId>(authData.organizationId);
      const tenant = {
        ...getMockTenant(tenantId),
        attributes: [
          getMockCertifiedTenantAttribute(unsafeBrandId<AttributeId>(tenantId)),
        ],
      };
      await addOneTenant(tenant, tenants);

      const agreementId = generateId<AgreementId>();
      const publishedDescriptor = {
        ...getMockDescriptorPublished(generateId<DescriptorId>(), [
          [getMockEServiceAttribute()],
        ]),
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
        id: agreementId,
        descriptorId: deprecatedDescriptor.id,
      };
      await addOneAgreement(agreement, postgresDB, agreements);

      const eservice = getMockEService(
        agreement.eserviceId,
        generateId<TenantId>(),
        [publishedDescriptor, deprecatedDescriptor]
      );
      await addOneEService(eservice, eservices);

      await expect(
        agreementService.upgradeAgreement(agreementId, authData, uuidv4())
      ).rejects.toThrowError(
        missingCertifiedAttributesError(publishedDescriptor.id, tenantId)
      );
    });

    it("should throw an FileManagerError type error when document copy fails", async () => {
      const authData = {
        ...getRandomAuthData(),
        userRoles: [userRoles.ADMIN_ROLE],
      };
      const tenantId = authData.organizationId.toString();
      const descriptorId = generateId<DescriptorId>();

      const agreementSubject = getMockAgreement(
        generateId<EServiceId>(),
        generateId<TenantId>(),
        randomArrayItem(agreementUpgradableStates)
      );

      const validVerifiedTenantAttribute = {
        ...getMockVerifiedTenantAttribute(unsafeBrandId<AttributeId>(tenantId)),
        verifiedBy: [
          {
            id: unsafeBrandId<TenantId>(tenantId),
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
        ...getMockDeclaredTenantAttribute(unsafeBrandId<AttributeId>(tenantId)),
        revocationTimestamp: new Date(TEST_EXECUTION_DATE.getFullYear() + 1),
      };

      const tenant = getMockTenant(unsafeBrandId<TenantId>(tenantId), [
        validVerifiedTenantAttribute,
        invalidDeclaredTenantAttribute,
      ]);
      await addOneTenant(tenant, tenants);

      const deprecatedDescriptor = {
        ...getMockDescriptorPublished(
          descriptorId,
          [],
          [[getMockEServiceAttribute()]],
          [[validVerifiedEserviceAttribute]]
        ),
        name: "deprecated-descriptor-doc",
        state: descriptorState.deprecated,
        version: "1",
      };

      const documentPublishedDescriptor = {
        ...generateMock(Document),
        name: "published-descriptor-doc",
      };
      const publishedDescriptor = {
        ...getMockDescriptorPublished(
          descriptorId,
          [],
          [[getMockEServiceAttribute()]],
          [[validVerifiedEserviceAttribute]]
        ),
        interface: {
          ...documentPublishedDescriptor,
          name: documentPublishedDescriptor.name,
          path: `${config.consumerDocumentsPath}/${descriptorId}/${documentPublishedDescriptor.name}`,
        },
        version: "2",
      };

      await uploadDocument(
        "unreachable-path",
        documentPublishedDescriptor.name
      );

      const agreementToBeUpgraded: Agreement = {
        ...agreementSubject,
        descriptorId,
        producerId: unsafeBrandId<TenantId>(tenantId),
        consumerId: unsafeBrandId<TenantId>(tenantId),
        stamps: {},
        createdAt: TEST_EXECUTION_DATE,
        consumerDocuments: [
          {
            id: unsafeBrandId<AgreementDocumentId>(
              publishedDescriptor.interface.id
            ),
            name: publishedDescriptor.interface.name,
            prettyName: publishedDescriptor.interface.prettyName,
            contentType: publishedDescriptor.interface.contentType,
            path: publishedDescriptor.interface.path,
            createdAt: publishedDescriptor.interface.uploadDate,
          },
        ],
      };

      await addOneAgreement(agreementToBeUpgraded, postgresDB, agreements);

      const eservice: EService = getMockEService(
        agreementToBeUpgraded.eserviceId,
        generateId<TenantId>(),
        [deprecatedDescriptor, publishedDescriptor]
      );
      await addOneEService(eservice, eservices);

      await expect(
        agreementService.upgradeAgreement(
          agreementToBeUpgraded.id,
          authData,
          uuidv4()
        )
      ).rejects.toThrowError(FileManagerError);
    });

    it("should throw an agreementAlreadyExists error when found a draft conflicting agreement with same consumer and e-service", async () => {
      const authData = {
        ...getRandomAuthData(),
        userRoles: [userRoles.ADMIN_ROLE],
      };
      const tenantId = authData.organizationId.toString();
      const descriptorId = generateId<DescriptorId>();

      const agreementSubject = getMockAgreement(
        generateId<EServiceId>(),
        generateId<TenantId>(),
        randomArrayItem(agreementUpgradableStates)
      );

      const validVerifiedTenantAttribute = {
        ...getMockVerifiedTenantAttribute(unsafeBrandId<AttributeId>(tenantId)),
        verifiedBy: [
          {
            id: unsafeBrandId<TenantId>(tenantId),
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
        ...getMockDeclaredTenantAttribute(unsafeBrandId<AttributeId>(tenantId)),
        revocationTimestamp: new Date(TEST_EXECUTION_DATE.getFullYear() + 1),
      };

      const tenant = getMockTenant(unsafeBrandId<TenantId>(tenantId), [
        validVerifiedTenantAttribute,
        invalidDeclaredTenantAttribute,
      ]);
      await addOneTenant(tenant, tenants);

      const deprecatedDescriptor = {
        ...getMockDescriptorPublished(
          descriptorId,
          [],
          [[getMockEServiceAttribute()]],
          [[validVerifiedEserviceAttribute]]
        ),
        name: "deprecated-descriptor-doc",
        state: descriptorState.deprecated,
        version: "1",
      };

      const documentPublishedDescriptor = {
        ...generateMock(Document),
        name: "published-descriptor-doc",
      };
      const publishedDescriptor = {
        ...getMockDescriptorPublished(
          descriptorId,
          [],
          [[getMockEServiceAttribute()]],
          [[validVerifiedEserviceAttribute]]
        ),
        interface: {
          ...documentPublishedDescriptor,
          name: documentPublishedDescriptor.name,
          path: `${config.consumerDocumentsPath}/${descriptorId}/${documentPublishedDescriptor.name}`,
        },
        version: "2",
      };

      await uploadDocument(
        "unreachable-path",
        documentPublishedDescriptor.name
      );

      const agreementToBeUpgraded: Agreement = {
        ...agreementSubject,
        descriptorId,
        producerId: unsafeBrandId<TenantId>(tenantId),
        consumerId: unsafeBrandId<TenantId>(tenantId),
        stamps: {},
        createdAt: TEST_EXECUTION_DATE,
        consumerDocuments: [
          {
            id: unsafeBrandId<AgreementDocumentId>(
              publishedDescriptor.interface.id
            ),
            name: publishedDescriptor.interface.name,
            prettyName: publishedDescriptor.interface.prettyName,
            contentType: publishedDescriptor.interface.contentType,
            path: publishedDescriptor.interface.path,
            createdAt: publishedDescriptor.interface.uploadDate,
          },
        ],
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
        generateId<TenantId>(),
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
