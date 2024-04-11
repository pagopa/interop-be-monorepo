/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable fp/no-delete */
/* eslint-disable functional/immutable-data */
import { fail } from "assert";
import { generateMock } from "@anatine/zod-mock";
import {
  getMockAgreement,
  getMockCertifiedTenantAttribute,
  getMockDeclaredTenantAttribute,
  getMockDescriptorPublished,
  getMockEService,
  getMockEServiceAttribute,
  getMockTenant,
  getMockVerifiedTenantAttribute,
  getRandomAuthData,
  StoredEvent,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementAddedV1,
  AgreementConsumerDocumentAddedV1,
  AgreementDocumentId,
  AgreementId,
  AgreementV1,
  AttributeId,
  Descriptor,
  DescriptorId,
  Document,
  EService,
  EServiceId,
  StampsV1,
  TenantId,
  agreementState,
  descriptorState,
  generateId,
  protobufDecoder,
  unsafeBrandId,
} from "pagopa-interop-models";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { FileManagerError, userRoles } from "pagopa-interop-commons";
import {
  toAgreementStateV1,
  toAgreementV1,
  toStampV1,
} from "../src/model/domain/toEvent.js";
import { config } from "../src/utilities/config.js";
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
  addOneAgreement,
  addOneEService,
  addOneTenant,
  readAgreementEventByVersion,
  readLastAgreementEvent,
} from "./utils.js";
import {
  eservices,
  tenants,
  postgresDB,
  agreementService,
  agreements,
  fileManager,
} from "./agreementService.integration.test.js";

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

    const decodeAgreementV1FromEvent = (
      actualAgreementData: StoredEvent,
      expectedStoreEvent: Omit<StoredEvent, "data" | "event_version">
    ): AgreementV1 => {
      const actualAgreement: AgreementV1 | undefined = protobufDecoder(
        AgreementAddedV1
      ).parse(actualAgreementData.data)?.agreement;

      if (!actualAgreement) {
        fail(`impossible to decode ${expectedStoreEvent.type} data`);
      }
      return actualAgreement;
    };

    const decodeAgreementDocumentV1FromEvent = (
      actualAgreementData: StoredEvent,
      expectedStoreEvent: Omit<StoredEvent, "data" | "event_version">
    ): AgreementConsumerDocumentAddedV1 => {
      const actualAgreementDocument:
        | AgreementConsumerDocumentAddedV1
        | undefined = protobufDecoder(AgreementConsumerDocumentAddedV1).parse(
        actualAgreementData.data
      );

      if (!actualAgreementDocument) {
        fail(`impossible to decode ${expectedStoreEvent.type} data`);
      }
      return actualAgreementDocument;
    };

    async function getExpectedAgreementEventV1<T>(
      agreementId: AgreementId | undefined,
      version: number | undefined,
      expectedStoreEvent: Omit<StoredEvent, "data" | "event_version">,
      decoderFunction: (
        event: StoredEvent,
        expectedStoreEvent: Omit<StoredEvent, "data" | "event_version">
      ) => T
    ): Promise<T> {
      expect(agreementId).toBeDefined();
      if (!agreementId) {
        fail(
          `Unhandled error: returned agreementId is undefined for ${agreementId}`
        );
      }

      const actualAgreementData: StoredEvent | undefined =
        version !== undefined
          ? await readAgreementEventByVersion(agreementId, version, postgresDB)
          : await readLastAgreementEvent(agreementId, postgresDB);

      if (!actualAgreementData) {
        fail("Creation fails: agreement not found in event-store");
      }

      expect(actualAgreementData).toMatchObject({
        ...expectedStoreEvent,
        event_version: 1,
      });

      return decoderFunction(actualAgreementData, expectedStoreEvent);
    }

    function toAgreementStampsV1(agreement: Agreement): StampsV1 {
      const stamps: StampsV1 = {};

      if (agreement.stamps.submission) {
        stamps.submission = toStampV1(agreement.stamps.submission);
      }

      if (agreement.stamps.activation) {
        stamps.activation = toStampV1(agreement.stamps.activation);
      }

      if (agreement.stamps.rejection) {
        stamps.rejection = toStampV1(agreement.stamps.rejection);
      }

      if (agreement.stamps.suspensionByProducer) {
        stamps.suspensionByProducer = toStampV1(
          agreement.stamps.suspensionByProducer
        );
      }

      if (agreement.stamps.suspensionByConsumer) {
        stamps.suspensionByConsumer = toStampV1(
          agreement.stamps.suspensionByConsumer
        );
      }

      if (agreement.stamps.upgrade) {
        stamps.upgrade = toStampV1(agreement.stamps.upgrade);
      }

      if (agreement.stamps.archiving) {
        stamps.archiving = toStampV1(agreement.stamps.archiving);
      }

      return stamps;
    }

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
        userRoles: [userRoles.INTERNAL_ROLE],
      };
      const tenantId = authData.organizationId.toString();

      const validVerifiedTenantAttribute = getMockVerifiedTenantAttribute(
        unsafeBrandId<AttributeId>(tenantId)
      );
      const validVerifiedEserviceAttribute = getMockEServiceAttribute(
        validVerifiedTenantAttribute.id
      );

      const validDeclaredTenantAttribute = getMockDeclaredTenantAttribute(
        unsafeBrandId<AttributeId>(tenantId)
      );
      const validDeclaredEserviceAttribute = getMockEServiceAttribute(
        validDeclaredTenantAttribute.id
      );

      const descriptorId = generateId<DescriptorId>();
      const deprecatedDescriptor = {
        ...getMockDescriptorPublished(
          descriptorId,
          [],
          [[validDeclaredEserviceAttribute]],
          [[validVerifiedEserviceAttribute]]
        ),
        path: "/deprecatedDescriptor/doc",
        state: descriptorState.deprecated,
        version: "1",
      };

      const publishedDescriptor: Descriptor = {
        ...getMockDescriptorPublished(descriptorId),
        version: "2",
      };

      const tenant = getMockTenant(unsafeBrandId<TenantId>(tenantId), [
        validDeclaredTenantAttribute,
        validVerifiedTenantAttribute,
      ]);
      const agreementToBeUpgraded: Agreement = {
        ...getMockAgreement(
          generateId<EServiceId>(),
          generateId<TenantId>(),
          agreementState.active
        ),
        descriptorId,
        producerId: unsafeBrandId<TenantId>(tenantId),
        stamps: {},
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

      const archivedAgreement = await getExpectedAgreementEventV1(
        agreementToBeUpgraded.id,
        0,
        {
          type: "AgreementUpdated",
          stream_id: agreementToBeUpgraded.id,
          version: "0",
        },
        decodeAgreementV1FromEvent
      );

      expect(archivedAgreement).toMatchObject({
        ...toAgreementV1(agreementToBeUpgraded),
        state: toAgreementStateV1(agreementState.archived),
        stamps: {
          ...toAgreementStampsV1(agreementToBeUpgraded),
          archiving: {
            who: authData.userId,
            when: BigInt(TEST_EXECUTION_DATE.getTime()),
          },
        },
      });

      expect(newAgreementId).toBeDefined();
      const actualCreatedAgreementV1 = await getExpectedAgreementEventV1(
        newAgreementId,
        0,
        {
          type: "AgreementAdded",
          stream_id: newAgreementId,
          version: "0",
        },
        decodeAgreementV1FromEvent
      );

      expect(actualCreatedAgreementV1)
        .property("createdAt")
        .satisfy(
          (createdAt: Date) =>
            new Date(Number(createdAt)) &&
            new Date(Number(createdAt)) <= TEST_EXECUTION_DATE
        );

      const createdAgreement = toAgreementV1(agreementToBeUpgraded);
      delete createdAgreement.updatedAt;
      delete createdAgreement.rejectionReason;

      const expectedCreatedAgreementV1 = {
        ...createdAgreement,
        id: newAgreementId,
        descriptorId: actualCreatedAgreementV1.descriptorId,
        createdAt: BigInt(TEST_EXECUTION_DATE.getTime()),
        stamps: {
          ...toAgreementStampsV1(agreementToBeUpgraded),
          upgrade: {
            who: authData.userId,
            when: BigInt(TEST_EXECUTION_DATE.getTime()),
          },
        },
      };

      expect(actualCreatedAgreementV1).toMatchObject(
        expectedCreatedAgreementV1
      );
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
        agreementState.active
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
      ]);
      await addOneTenant(tenant, tenants);

      const deprecatedDescriptor = {
        ...getMockDescriptorPublished(
          descriptorId,
          [],
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
          [],
          [],
          [[getMockEServiceAttribute()]]
        ),
        interface: {
          ...documentPublishedDescriptor,
          name: documentPublishedDescriptor.name,
          path: `${config.consumerDocumentsPath}/${descriptorId}/${documentPublishedDescriptor.name}`,
        },
        version: "2",
      };

      await uploadDocument(`${descriptorId}`, documentPublishedDescriptor.name);

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
      const actualCreatedAgreementV1 = await getExpectedAgreementEventV1(
        newAgreementId,
        0,
        {
          type: "AgreementAdded",
          stream_id: newAgreementId,
          version: "0",
        },
        decodeAgreementV1FromEvent
      );

      expect(actualCreatedAgreementV1)
        .property("createdAt")
        .satisfy(
          (createdAt: Date) =>
            new Date(Number(createdAt)) &&
            new Date(Number(createdAt)) <= TEST_EXECUTION_DATE
        );

      const expectedCreatedAgreementV1 = {
        id: expect.any(String),
        eserviceId: agreementToBeUpgraded.eserviceId,
        descriptorId,
        producerId: agreementToBeUpgraded.producerId,
        consumerId: agreementToBeUpgraded.consumerId,
        verifiedAttributes: agreementToBeUpgraded.verifiedAttributes,
        certifiedAttributes: agreementToBeUpgraded.certifiedAttributes,
        declaredAttributes: agreementToBeUpgraded.declaredAttributes,
        consumerNotes: agreementToBeUpgraded.consumerNotes,
        state: toAgreementStateV1(agreementState.draft),
        createdAt: BigInt(TEST_EXECUTION_DATE.getTime()),
        consumerDocuments: [],
        stamps: {},
      };

      expect(actualCreatedAgreementV1).toMatchObject(
        expectedCreatedAgreementV1
      );

      const actualAgreementDocumentAddedV1 = await getExpectedAgreementEventV1(
        newAgreementId,
        1,
        {
          type: "AgreementConsumerDocumentAdded",
          stream_id: newAgreementId,
          version: "1",
        },
        decodeAgreementDocumentV1FromEvent
      );

      const expectedUploadedDocumentPath = `${config.consumerDocumentsPath}/${actualCreatedAgreementV1.id}/${actualAgreementDocumentAddedV1.document?.id}/${documentPublishedDescriptor.name}`;
      expect(actualAgreementDocumentAddedV1.document).toBeDefined();
      if (!actualAgreementDocumentAddedV1.document) {
        fail("Document not found in event");
      }
      expect(actualAgreementDocumentAddedV1.document).toMatchObject({
        id: actualAgreementDocumentAddedV1.document.id,
        name: documentPublishedDescriptor.name,
        prettyName: documentPublishedDescriptor.prettyName,
        contentType: documentPublishedDescriptor.contentType,
        path: expectedUploadedDocumentPath,
        createdAt: BigInt(TEST_EXECUTION_DATE.getTime()),
      });
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
        agreementState.active
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

      await uploadDocument(`${descriptorId}`, documentPublishedDescriptor.name);

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
      const actualCreatedAgreementV1 = await getExpectedAgreementEventV1(
        newAgreementId,
        0,
        {
          type: "AgreementAdded",
          stream_id: newAgreementId,
          version: "0",
        },
        decodeAgreementV1FromEvent
      );

      expect(actualCreatedAgreementV1)
        .property("createdAt")
        .satisfy(
          (createdAt: Date) =>
            new Date(Number(createdAt)) &&
            new Date(Number(createdAt)) <= TEST_EXECUTION_DATE
        );

      const expectedCreatedAgreementV1 = {
        id: expect.any(String),
        eserviceId: agreementToBeUpgraded.eserviceId,
        descriptorId,
        producerId: agreementToBeUpgraded.producerId,
        consumerId: agreementToBeUpgraded.consumerId,
        verifiedAttributes: agreementToBeUpgraded.verifiedAttributes,
        certifiedAttributes: agreementToBeUpgraded.certifiedAttributes,
        declaredAttributes: agreementToBeUpgraded.declaredAttributes,
        consumerNotes: agreementToBeUpgraded.consumerNotes,
        state: toAgreementStateV1(agreementState.draft),
        createdAt: BigInt(TEST_EXECUTION_DATE.getTime()),
        consumerDocuments: [],
        stamps: {},
      };

      expect(actualCreatedAgreementV1).toMatchObject(
        expectedCreatedAgreementV1
      );

      const actualAgreementDocumentAddedV1 = await getExpectedAgreementEventV1(
        newAgreementId,
        1,
        {
          type: "AgreementConsumerDocumentAdded",
          stream_id: newAgreementId,
          version: "1",
        },
        decodeAgreementDocumentV1FromEvent
      );

      const expectedUploadedDocumentPath = `${config.consumerDocumentsPath}/${actualCreatedAgreementV1.id}/${actualAgreementDocumentAddedV1.document?.id}/${documentPublishedDescriptor.name}`;
      expect(actualAgreementDocumentAddedV1.document).toBeDefined();
      if (!actualAgreementDocumentAddedV1.document) {
        fail("Document not found in event");
      }
      expect(actualAgreementDocumentAddedV1.document).toMatchObject({
        id: actualAgreementDocumentAddedV1.document.id,
        name: documentPublishedDescriptor.name,
        prettyName: documentPublishedDescriptor.prettyName,
        contentType: documentPublishedDescriptor.contentType,
        path: expectedUploadedDocumentPath,
        createdAt: BigInt(TEST_EXECUTION_DATE.getTime()),
      });
    });

    it("should throw error tenant does not exist", async () => {
      const authData = getRandomAuthData();
      const agreementId = generateId<AgreementId>();
      await expect(
        agreementService.upgradeAgreement(agreementId, authData, uuidv4())
      ).rejects.toThrowError(tenantIdNotFound(authData.organizationId));
    });

    it("should throw error agreement does not exist", async () => {
      const authData = getRandomAuthData();
      const agreementId = generateId<AgreementId>();

      const tenantId = authData.organizationId.toString();
      const tenant = getMockTenant(unsafeBrandId<TenantId>(tenantId));

      await addOneTenant(tenant, tenants);
      await expect(
        agreementService.upgradeAgreement(agreementId, authData, uuidv4())
      ).rejects.toThrowError(agreementNotFound(agreementId));
    });

    it("should throw error if requester is not consumer", async () => {
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
          agreementState.active
        ),
        id: agreementId,
      };

      await addOneAgreement(agreement, postgresDB, agreements);
      await expect(
        agreementService.upgradeAgreement(agreementId, authData, uuidv4())
      ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
    });

    it("should throw error if agreement is not in upgradable states", async () => {
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
          agreementState.active
        ),
        id: agreementId,
        state: agreementState.rejected,
      };

      await addOneAgreement(agreement, postgresDB, agreements);
      await expect(
        agreementService.upgradeAgreement(agreementId, authData, uuidv4())
      ).rejects.toThrowError(
        agreementNotInExpectedState(agreementId, agreementState.rejected)
      );
    });

    it("should throw error if eservice not exists", async () => {
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
          agreementState.active
        ),
        id: agreementId,
        state: agreementState.active,
      };

      await addOneAgreement(agreement, postgresDB, agreements);
      await expect(
        agreementService.upgradeAgreement(agreementId, authData, uuidv4())
      ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));
    });

    it("should throw error if published descriptor not exists", async () => {
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
          agreementState.active
        ),
        id: agreementId,
        state: agreementState.active,
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

    it("should throw error if published descriptor has unexpected version format", async () => {
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
          agreementState.active
        ),
        id: agreementId,
        state: agreementState.active,
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

    it("should throw error if agreement descriptor not exists", async () => {
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
          agreementState.active
        ),
        id: agreementId,
        state: agreementState.active,
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

    it("should throw error if agreement descriptor has invalid format", async () => {
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
          agreementState.active
        ),
        id: agreementId,
        state: agreementState.active,
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

    it("should throw error if latest pusblished descriptor have version number great than descriptor in agreement", async () => {
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
          agreementState.active
        ),
        id: agreementId,
        state: agreementState.active,
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

    it("should throw error if published descriptor with invalid certified attributes", async () => {
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
          agreementState.active
        ),
        id: agreementId,
        state: agreementState.active,
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

    it("should throw error when document copy fails", async () => {
      const authData = {
        ...getRandomAuthData(),
        userRoles: [userRoles.ADMIN_ROLE],
      };
      const tenantId = authData.organizationId.toString();
      const descriptorId = generateId<DescriptorId>();

      const agreementSubject = getMockAgreement(
        generateId<EServiceId>(),
        generateId<TenantId>(),
        agreementState.active
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

    it("should throw error when found a draft conflicting agreement with same consumer and e-service", async () => {
      const authData = {
        ...getRandomAuthData(),
        userRoles: [userRoles.ADMIN_ROLE],
      };
      const tenantId = authData.organizationId.toString();
      const descriptorId = generateId<DescriptorId>();

      const agreementSubject = getMockAgreement(
        generateId<EServiceId>(),
        generateId<TenantId>(),
        agreementState.active
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
