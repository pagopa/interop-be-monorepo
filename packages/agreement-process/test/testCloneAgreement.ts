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
import {
  agreementClonableStates,
  agreementCloningConflictingStates,
} from "../src/model/domain/validators.js";
import { toAgreementV1 } from "../src/model/domain/toEvent.js";
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

      agreementConsumerDocuments.forEach(async (doc, index) => {
        const agreementDocumentAddedEvent = await readAgreementEventByVersion(
          newAgreementId,
          index,
          postgresDB
        );

        expect(agreementDocumentAddedEvent).toMatchObject({
          type: "AgreementConsumerDocumentAdded",
          event_version: 1,
          version: index.toString(),
          stream_id: newAgreementId,
        });

        // const agreementDocumentAddedEventPayload = decodeProtobufPayload({
        //   messageType: AgreementConsumerDocumentAddedV1,
        //   payload: agreementDocumentAddedEvent.data,
        // });

        // expect(agreementDocumentAddedEventPayload).toMatchObject({
        //   agreemendId: newAgreementId,
        // });
      });
      // expect(await fileManager.listFiles(config.s3Bucket)).toContain(
      //   expectedInterface.path
      // );
    });
  });
