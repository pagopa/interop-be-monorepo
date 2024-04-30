/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable fp/no-delete */
import {
  decodeProtobufPayload,
  getMockAgreement,
  getMockCertifiedTenantAttribute,
  getMockDescriptorPublished,
  getMockEService,
  getMockEServiceAttribute,
  getMockTenant,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  AgreementAddedV1,
  AgreementConsumerDocumentAddedV1,
  AgreementDocumentId,
  AgreementId,
  AgreementV1,
  DescriptorId,
  EServiceId,
  TenantId,
  agreementState,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { FileManagerError } from "pagopa-interop-commons";
import {
  agreementClonableStates,
  agreementCloningConflictingStates,
} from "../src/model/domain/validators.js";
import {
  toAgreementDocumentV1,
  toAgreementV1,
} from "../src/model/domain/toEvent.js";
import { config } from "../src/utilities/config.js";
import {
  agreementAlreadyExists,
  agreementNotFound,
  agreementNotInExpectedState,
  descriptorNotFound,
  eServiceNotFound,
  missingCertifiedAttributesError,
  operationNotAllowed,
  tenantIdNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  getMockConsumerDocument,
  readAgreementEventByVersion,
  uploadDocument,
} from "./utils.js";
import {
  agreementService,
  agreements,
  eservices,
  fileManager,
  postgresDB,
  tenants,
} from "./agreementService.integration.test.js";

export const testCloneAgreement = (): ReturnType<typeof describe> =>
  describe("clone agreement", () => {
    const TEST_EXECUTION_DATE = new Date();

    beforeAll(() => {
      vi.useFakeTimers();
      vi.setSystemTime(TEST_EXECUTION_DATE);
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    it("should succeed when requester is Consumer and the Agreement is in a clonable state", async () => {
      const authData = getRandomAuthData();
      const consumerId = authData.organizationId;

      const validCertifiedTenantAttribute = {
        ...getMockCertifiedTenantAttribute(),
        revocationTimestamp: undefined,
      };

      const validCertifiedEserviceAttribute = getMockEServiceAttribute(
        validCertifiedTenantAttribute.id
      );

      const consumer = getMockTenant(consumerId, [
        validCertifiedTenantAttribute,
      ]);

      const descriptor = getMockDescriptorPublished(
        generateId<DescriptorId>(),
        [[validCertifiedEserviceAttribute]],
        // Declared and verified attributes shall not be validated: we add some random ones to test that
        [[getMockEServiceAttribute()]],
        [[getMockEServiceAttribute()]]
      );
      const eservice = getMockEService(
        generateId<EServiceId>(),
        generateId<TenantId>(),
        [descriptor]
      );

      const agreementId = generateId<AgreementId>();

      const docsNumber = Math.floor(Math.random() * 10) + 1;
      const agreementConsumerDocuments = Array.from(
        { length: docsNumber },
        () => getMockConsumerDocument(agreementId)
      );
      const agreementToBeCloned = {
        ...getMockAgreement(
          eservice.id,
          consumerId,
          randomArrayItem(agreementClonableStates)
        ),
        id: agreementId,
        producerId: eservice.producerId,
        descriptorId: descriptor.id,
        consumerDocuments: agreementConsumerDocuments,
      };

      await addOneTenant(consumer, tenants);
      await addOneEService(eservice, eservices);
      await addOneAgreement(agreementToBeCloned, postgresDB, agreements);

      for (const doc of agreementConsumerDocuments) {
        await uploadDocument(agreementId, doc.id, doc.name, fileManager);
      }

      const anotherNonConflictingAgreement = {
        ...getMockAgreement(
          eservice.id,
          consumerId,
          randomArrayItem(
            Object.values(agreementState).filter(
              (s) => !agreementCloningConflictingStates.includes(s)
            )
          )
        ),
        producerId: eservice.producerId,
      };
      await addOneAgreement(
        anotherNonConflictingAgreement,
        postgresDB,
        agreements
      );

      const newAgreementId = unsafeBrandId<AgreementId>(
        await agreementService.cloneAgreement(
          agreementToBeCloned.id,
          authData,
          uuidv4()
        )
      );

      const agreementClonedEvent = await readAgreementEventByVersion(
        newAgreementId,
        0,
        postgresDB
      );

      expect(agreementClonedEvent).toMatchObject({
        type: "AgreementAdded",
        event_version: 1,
        version: "0",
        stream_id: newAgreementId,
      });

      const agreementClonedEventPayload = decodeProtobufPayload({
        messageType: AgreementAddedV1,
        payload: agreementClonedEvent.data,
      });

      const expectedAgreementCloned: AgreementV1 = toAgreementV1({
        id: newAgreementId,
        eserviceId: agreementToBeCloned.eserviceId,
        descriptorId: agreementToBeCloned.descriptorId,
        producerId: agreementToBeCloned.producerId,
        consumerId: agreementToBeCloned.consumerId,
        consumerNotes: agreementToBeCloned.consumerNotes,
        verifiedAttributes: [],
        certifiedAttributes: [],
        declaredAttributes: [],
        state: agreementState.draft,
        createdAt: TEST_EXECUTION_DATE,
        consumerDocuments: [],
        stamps: {},
      });
      delete expectedAgreementCloned.suspendedAt;
      delete expectedAgreementCloned.updatedAt;
      delete expectedAgreementCloned.contract;
      expectedAgreementCloned.stamps = {};

      expect(agreementClonedEventPayload).toMatchObject({
        agreement: expectedAgreementCloned,
      });

      for (let index = 0; index < agreementConsumerDocuments.length; index++) {
        const version = index + 1;
        const agreementConsumerDocument = agreementConsumerDocuments[index];
        const agreementDocumentAddedEvent = await readAgreementEventByVersion(
          newAgreementId,
          version,
          postgresDB
        );

        expect(agreementDocumentAddedEvent).toMatchObject({
          type: "AgreementConsumerDocumentAdded",
          event_version: 1,
          version: version.toString(),
          stream_id: newAgreementId,
        });

        const agreementDocumentAddedEventPayload = decodeProtobufPayload({
          messageType: AgreementConsumerDocumentAddedV1,
          payload: agreementDocumentAddedEvent.data,
        });

        const expectedClonedDocumentPath = `${
          config.consumerDocumentsPath
        }/${newAgreementId}/${
          agreementDocumentAddedEventPayload.document!.id
        }/${agreementConsumerDocument.name}`;

        const expectedClonedDocument = {
          id: unsafeBrandId<AgreementDocumentId>(
            agreementDocumentAddedEventPayload.document!.id
          ),
          name: agreementConsumerDocument.name,
          prettyName: agreementConsumerDocument.prettyName,
          contentType: agreementConsumerDocument.contentType,
          path: expectedClonedDocumentPath,
          createdAt: TEST_EXECUTION_DATE,
        };

        expect(agreementDocumentAddedEventPayload).toMatchObject({
          agreementId: newAgreementId,
          document: toAgreementDocumentV1(expectedClonedDocument),
        });

        expect(await fileManager.listFiles(config.s3Bucket)).toContain(
          expectedClonedDocumentPath
        );
      }
    });

    it("should throw an agreementNotFound error when the Agreement does not exist", async () => {
      await addOneAgreement(getMockAgreement(), postgresDB, agreements);
      const authData = getRandomAuthData();
      const agreementId = generateId<AgreementId>();
      await expect(
        agreementService.cloneAgreement(agreementId, authData, uuidv4())
      ).rejects.toThrowError(agreementNotFound(agreementId));
    });

    it("should throw an operationNotAllowed error when the requester is not the Consumer", async () => {
      const authData = getRandomAuthData();
      const agreement = getMockAgreement();
      await addOneAgreement(agreement, postgresDB, agreements);
      await expect(
        agreementService.cloneAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
    });

    it("should throw an agreementNotInExpectedState error when the Agreement is not in a clonable state", async () => {
      const authData = getRandomAuthData();
      const consumerId = authData.organizationId;
      const agreement = getMockAgreement(
        generateId<EServiceId>(),
        consumerId,
        randomArrayItem(
          Object.values(agreementState).filter(
            (s) => !agreementClonableStates.includes(s)
          )
        )
      );

      await addOneAgreement(agreement, postgresDB, agreements);
      await expect(
        agreementService.cloneAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(
        agreementNotInExpectedState(agreement.id, agreement.state)
      );
    });

    it("should throw an eserviceNotFound error when the EService does not exist", async () => {
      const authData = getRandomAuthData();
      const consumerId = authData.organizationId;
      const agreement = getMockAgreement(
        generateId<EServiceId>(),
        consumerId,
        randomArrayItem(agreementClonableStates)
      );

      await addOneAgreement(agreement, postgresDB, agreements);
      await expect(
        agreementService.cloneAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(eServiceNotFound(agreement.eserviceId));
    });

    it("should throw an agreementAlreadyExists error when a conflicting Agreement already exists", async () => {
      const authData = getRandomAuthData();
      const consumerId = authData.organizationId;
      const eservice = getMockEService();
      const agreement = {
        ...getMockAgreement(
          eservice.id,
          consumerId,
          randomArrayItem(agreementClonableStates)
        ),
        producerId: eservice.producerId,
      };

      const conflictingAgreement = {
        ...getMockAgreement(
          eservice.id,
          consumerId,
          randomArrayItem(agreementCloningConflictingStates)
        ),
        producerId: eservice.producerId,
      };

      await addOneEService(eservice, eservices);
      await addOneAgreement(agreement, postgresDB, agreements);
      await addOneAgreement(conflictingAgreement, postgresDB, agreements);
      await expect(
        agreementService.cloneAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(agreementAlreadyExists(consumerId, eservice.id));
    });

    it("should throw a tenantIdNotFound error when the Consumer does not exist", async () => {
      const authData = getRandomAuthData();
      const consumerId = authData.organizationId;
      const eservice = getMockEService();
      const agreement = {
        ...getMockAgreement(
          eservice.id,
          consumerId,
          randomArrayItem(agreementClonableStates)
        ),
        producerId: eservice.producerId,
      };

      const conflictingAgreement = {
        ...getMockAgreement(
          eservice.id,
          consumerId,
          randomArrayItem(
            Object.values(agreementState).filter(
              (s) => !agreementCloningConflictingStates.includes(s)
            )
          )
        ),
        producerId: eservice.producerId,
      };

      await addOneEService(eservice, eservices);
      await addOneAgreement(agreement, postgresDB, agreements);
      await addOneAgreement(conflictingAgreement, postgresDB, agreements);
      await expect(
        agreementService.cloneAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(tenantIdNotFound(consumerId));
    });

    it("should throw a descriptorNotFound error when the Descriptor does not exist", async () => {
      const authData = getRandomAuthData();
      const consumerId = authData.organizationId;
      const consumer = getMockTenant(consumerId);
      const eservice = getMockEService();
      const agreement = {
        ...getMockAgreement(
          eservice.id,
          consumerId,
          randomArrayItem(agreementClonableStates)
        ),
        producerId: eservice.producerId,
      };

      await addOneTenant(consumer, tenants);
      await addOneEService(eservice, eservices);
      await addOneAgreement(agreement, postgresDB, agreements);
      await expect(
        agreementService.cloneAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(
        descriptorNotFound(eservice.id, agreement.descriptorId)
      );
    });

    it("should throw a missingCertifiedAttributesError when the Consumer has invalid certified attributes", async () => {
      const authData = getRandomAuthData();
      const consumerId = authData.organizationId;

      const invalidCertifiedTenantAttribute = {
        ...getMockCertifiedTenantAttribute(),
        revocationTimestamp: new Date(),
      };

      const invalidCertifiedEserviceAttribute = getMockEServiceAttribute(
        invalidCertifiedTenantAttribute.id
      );

      const consumer = getMockTenant(consumerId, [
        invalidCertifiedTenantAttribute,
      ]);

      const descriptor = getMockDescriptorPublished(
        generateId<DescriptorId>(),
        [[invalidCertifiedEserviceAttribute]]
      );
      const eservice = getMockEService(
        generateId<EServiceId>(),
        generateId<TenantId>(),
        [descriptor]
      );

      const agreementId = generateId<AgreementId>();

      const agreement = {
        ...getMockAgreement(
          eservice.id,
          consumerId,
          randomArrayItem(agreementClonableStates)
        ),
        id: agreementId,
        producerId: eservice.producerId,
        descriptorId: descriptor.id,
      };

      await addOneTenant(consumer, tenants);
      await addOneEService(eservice, eservices);
      await addOneAgreement(agreement, postgresDB, agreements);

      await expect(
        agreementService.cloneAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(
        missingCertifiedAttributesError(descriptor.id, consumerId)
      );
    });

    it("should throw a FileManagerError error when document copy fails", async () => {
      const authData = getRandomAuthData();
      const consumerId = authData.organizationId;

      const consumer = getMockTenant(consumerId);

      const descriptor = getMockDescriptorPublished();
      const eservice = getMockEService(
        generateId<EServiceId>(),
        generateId<TenantId>(),
        [descriptor]
      );

      const agreementId = generateId<AgreementId>();

      const agreement = {
        ...getMockAgreement(
          eservice.id,
          consumerId,
          randomArrayItem(agreementClonableStates)
        ),
        id: agreementId,
        producerId: eservice.producerId,
        descriptorId: descriptor.id,
        consumerDocuments: [getMockConsumerDocument(agreementId)],
      };

      await addOneTenant(consumer, tenants);
      await addOneEService(eservice, eservices);
      await addOneAgreement(agreement, postgresDB, agreements);

      await expect(
        agreementService.cloneAgreement(agreement.id, authData, uuidv4())
      ).rejects.toThrowError(FileManagerError);
    });
  });
