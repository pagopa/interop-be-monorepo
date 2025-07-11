/* eslint-disable functional/no-let */
import { generateMock } from "@anatine/zod-mock";
import { fileManagerDeleteError, genericLogger } from "pagopa-interop-commons";
import {
  addSomeRandomDelegations,
  decodeProtobufPayload,
  getMockAgreement,
  getMockContext,
  getMockDelegation,
  getMockEService,
  getMockTenant,
  getMockAuthData,
  randomArrayItem,
  sortAgreementV2,
  getMockDescriptorPublished,
  sortAgreement,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementConsumerDocumentAddedV2,
  AgreementConsumerDocumentRemovedV2,
  AgreementDocument,
  AgreementDocumentId,
  AgreementId,
  EServiceId,
  TenantId,
  agreementState,
  delegationKind,
  delegationState,
  generateId,
  toAgreementV2,
  unsafeBrandId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it } from "vitest";
import { agreementConsumerDocumentChangeValidStates } from "../../src/model/domain/agreement-validators.js";
import {
  agreementDocumentAlreadyExists,
  agreementDocumentNotFound,
  agreementNotFound,
  documentChangeNotAllowed,
  tenantIsNotTheConsumer,
  tenantIsNotTheDelegateConsumer,
  tenantNotAllowed,
} from "../../src/model/domain/errors.js";
import { config } from "../../src/config/config.js";
import {
  addOneAgreement,
  addOneDelegation,
  addOneEService,
  addOneTenant,
  agreementService,
  fileManager,
  readLastAgreementEvent,
  uploadDocument,
} from "../integrationUtils.js";
import { getMockConsumerDocument } from "../mockUtils.js";

describe("agreement consumer document", () => {
  describe("get", () => {
    it("should succeed when the requester is the consumer or producer", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        consumerDocuments: [
          generateMock(AgreementDocument),
          generateMock(AgreementDocument),
        ],
      };

      await addOneAgreement(agreement);

      const consumerAuthData = getMockAuthData(agreement.consumerId);
      for (const document of agreement.consumerDocuments) {
        const retrievedDocument =
          await agreementService.getAgreementConsumerDocument(
            agreement.id,
            document.id,
            getMockContext({ authData: consumerAuthData })
          );
        expect(retrievedDocument).toEqual(document);
      }

      const producerAuthData = getMockAuthData(agreement.producerId);
      for (const document of agreement.consumerDocuments) {
        const retrievedDocument =
          await agreementService.getAgreementConsumerDocument(
            agreement.id,
            document.id,
            getMockContext({ authData: producerAuthData })
          );
        expect(retrievedDocument).toEqual(document);
      }
    });

    it("should succeed when the requester is the producer delegate", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      const authData = getMockAuthData();
      const eservice = {
        ...getMockEService(),
        producerId: producer.id,
        consumerId: consumer.id,
        descriptors: [getMockDescriptorPublished()],
      };
      const agreement = {
        ...getMockAgreement(eservice.id),
        descriptorId: eservice.descriptors[0].id,
        producerId: producer.id,
        consumerId: consumer.id,
        consumerDocuments: [generateMock(AgreementDocument)],
      };
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        delegateId: authData.organizationId,
        eserviceId: eservice.id,
        delegatorId: eservice.producerId,
        state: delegationState.active,
      });
      const delegate = getMockTenant(delegation.delegateId);

      await addOneTenant(delegate);
      await addOneEService(eservice);
      await addOneAgreement(agreement);
      await addOneDelegation(delegation);
      await addSomeRandomDelegations(agreement, addOneDelegation);

      const result = await agreementService.getAgreementConsumerDocument(
        agreement.id,
        agreement.consumerDocuments[0].id,
        getMockContext({ authData })
      );

      expect(result).toEqual(agreement.consumerDocuments[0]);
    });

    it("should succeed when requester is the consumer delegate", async () => {
      const agreementId = generateId<AgreementId>();
      const consumerDocuments = [
        getMockConsumerDocument(agreementId, "doc1"),
        getMockConsumerDocument(agreementId, "doc2"),
      ];
      const agreement: Agreement = {
        ...getMockAgreement(),
        id: agreementId,
        consumerDocuments,
      };

      const authData = getMockAuthData();
      const delegateId = authData.organizationId;

      const delegation = getMockDelegation({
        kind: delegationKind.delegatedConsumer,
        eserviceId: agreement.eserviceId,
        delegatorId: agreement.consumerId,
        delegateId,
        state: delegationState.active,
      });

      await addOneAgreement(agreement);
      await addOneDelegation(delegation);
      await addSomeRandomDelegations(agreement, addOneDelegation);

      for (const document of consumerDocuments) {
        const result = await agreementService.getAgreementConsumerDocument(
          agreement.id,
          document.id,
          getMockContext({ authData })
        );

        expect(result).toEqual(document);
      }
    });

    it("should succeed when the requester is the consumer, even if there is an active consumer delegation", async () => {
      const authData = getMockAuthData();

      const agreement = {
        ...getMockAgreement(),
        consumerId: authData.organizationId,
        consumerDocuments: [generateMock(AgreementDocument)],
      };

      const delegation = getMockDelegation({
        kind: delegationKind.delegatedConsumer,
        eserviceId: agreement.eserviceId,
        delegatorId: agreement.consumerId,
        delegateId: generateId<TenantId>(),
        state: delegationState.active,
      });

      await addOneAgreement(agreement);
      await addOneDelegation(delegation);

      const result = await agreementService.getAgreementConsumerDocument(
        agreement.id,
        agreement.consumerDocuments[0].id,
        getMockContext({ authData })
      );

      expect(result).toEqual(agreement.consumerDocuments[0]);
    });

    it("should succeed when the requester is the producer, even if there is an active producer delegation", async () => {
      const producer = getMockTenant();
      const consumer = getMockTenant();
      const authData = getMockAuthData(producer.id);
      const eservice = {
        ...getMockEService(),
        producerId: producer.id,
        consumerId: consumer.id,
        descriptors: [getMockDescriptorPublished()],
      };
      const agreement = {
        ...getMockAgreement(eservice.id),
        descriptorId: eservice.descriptors[0].id,
        producerId: producer.id,
        consumerId: consumer.id,
        consumerDocuments: [generateMock(AgreementDocument)],
      };
      const delegation = getMockDelegation({
        kind: delegationKind.delegatedProducer,
        delegateId: generateId<TenantId>(),
        eserviceId: eservice.id,
        delegatorId: eservice.producerId,
        state: delegationState.active,
      });

      await addOneEService(eservice);
      await addOneAgreement(agreement);
      await addOneDelegation(delegation);

      const result = await agreementService.getAgreementConsumerDocument(
        agreement.id,
        agreement.consumerDocuments[0].id,
        getMockContext({ authData })
      );

      expect(result).toEqual(agreement.consumerDocuments[0]);
    });

    it("should throw an agreementNotFound error when the agreement does not exist", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        consumerDocuments: [
          generateMock(AgreementDocument),
          generateMock(AgreementDocument),
        ],
      };

      await addOneAgreement(agreement);
      await addOneAgreement(getMockAgreement());

      const randomAgreementId = generateId<AgreementId>();
      const authData = getMockAuthData(agreement.consumerId);

      await expect(
        agreementService.getAgreementConsumerDocument(
          randomAgreementId,
          agreement.consumerDocuments[0].id,
          getMockContext({ authData })
        )
      ).rejects.toThrowError(agreementNotFound(randomAgreementId));
    });

    it("should throw an tenantNotAllowed error when the requester is not the consumer or producer", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        consumerDocuments: [
          generateMock(AgreementDocument),
          generateMock(AgreementDocument),
        ],
      };

      await addOneAgreement(agreement);

      const authData = getMockAuthData();

      await expect(
        agreementService.getAgreementConsumerDocument(
          agreement.id,
          agreement.consumerDocuments[0].id,
          getMockContext({ authData })
        )
      ).rejects.toThrowError(tenantNotAllowed(authData.organizationId));
    });

    it("should throw an agreementDocumentNotFound error when the document does not exist", async () => {
      const agreement: Agreement = {
        ...getMockAgreement(),
        consumerDocuments: [
          generateMock(AgreementDocument),
          generateMock(AgreementDocument),
        ],
      };

      await addOneAgreement(agreement);
      await addOneAgreement(getMockAgreement());

      const authData = getMockAuthData(agreement.consumerId);
      const randomDocumentId = generateId<AgreementDocumentId>();

      await expect(
        agreementService.getAgreementConsumerDocument(
          agreement.id,
          randomDocumentId,
          getMockContext({ authData })
        )
      ).rejects.toThrowError(
        agreementDocumentNotFound(randomDocumentId, agreement.id)
      );
    });
  });

  describe("add", () => {
    it("should succeed on happy path when the requester is the Consumer", async () => {
      const authData = getMockAuthData();
      const organizationId = authData.organizationId;
      const agreement = getMockAgreement(
        generateId<EServiceId>(),
        organizationId
      );

      const consumerDocument = getMockConsumerDocument(agreement.id);

      await addOneAgreement(agreement);

      const returnedConsumerDocument =
        await agreementService.addConsumerDocument(
          agreement.id,
          consumerDocument,
          getMockContext({ authData })
        );
      const { data: payload } = await readLastAgreementEvent(agreement.id);

      const actualConsumerDocument = decodeProtobufPayload({
        messageType: AgreementConsumerDocumentAddedV2,
        payload,
      });

      const expectedConsumerDocument = {
        ...consumerDocument,
        createdAt: returnedConsumerDocument.data.createdAt,
      };

      const expectedAgreement = {
        ...agreement,
        consumerDocuments: [
          ...agreement.consumerDocuments,
          expectedConsumerDocument,
        ],
      };

      expect({
        agreement: sortAgreementV2(actualConsumerDocument.agreement),
        documentId: actualConsumerDocument.documentId,
      }).toMatchObject({
        agreement: sortAgreementV2(toAgreementV2(expectedAgreement)),
        documentId: consumerDocument.id,
      });

      expect(returnedConsumerDocument).toEqual({
        data: expectedConsumerDocument,
        metadata: { version: 1 },
      });
    });

    it("should succeed on happy path when the requester is the Consumer Delegate", async () => {
      const authData = getMockAuthData();
      const consumerId = generateId<TenantId>();
      const organizationId = authData.organizationId;
      const agreement = getMockAgreement(generateId<EServiceId>(), consumerId);

      const consumerDocument = getMockConsumerDocument(agreement.id);

      await addOneAgreement(agreement);

      const delegation = getMockDelegation({
        kind: delegationKind.delegatedConsumer,
        delegateId: organizationId,
        delegatorId: consumerId,
        eserviceId: agreement.eserviceId,
        state: delegationState.active,
      });
      await addOneDelegation(delegation);
      await addSomeRandomDelegations(agreement, addOneDelegation);

      const returnedConsumerDocument =
        await agreementService.addConsumerDocument(
          agreement.id,
          consumerDocument,
          getMockContext({ authData })
        );
      const { data: payload } = await readLastAgreementEvent(agreement.id);

      const actualConsumerDocument = decodeProtobufPayload({
        messageType: AgreementConsumerDocumentAddedV2,
        payload,
      });

      const expectedConsumerDocument = {
        ...consumerDocument,
        createdAt: returnedConsumerDocument.data.createdAt,
      };

      const expectedAgreement = {
        ...agreement,
        consumerDocuments: [
          ...agreement.consumerDocuments,
          expectedConsumerDocument,
        ],
      };

      expect({
        agreement: sortAgreementV2(actualConsumerDocument.agreement),
        documentId: actualConsumerDocument.documentId,
      }).toMatchObject({
        agreement: sortAgreementV2(toAgreementV2(expectedAgreement)),
        documentId: consumerDocument.id,
      });

      expect(returnedConsumerDocument).toEqual({
        data: expectedConsumerDocument,
        metadata: { version: 1 },
      });
    });

    it("should throw an agreementNotFound error when the agreement does not exist", async () => {
      const authData = getMockAuthData();
      await addOneAgreement(getMockAgreement());

      const wrongAgreementId = generateId<AgreementId>();
      const consumerDocument = getMockConsumerDocument(wrongAgreementId);
      const actualConsumerDocument = agreementService.addConsumerDocument(
        wrongAgreementId,
        consumerDocument,
        getMockContext({ authData })
      );

      await expect(actualConsumerDocument).rejects.toThrowError(
        agreementNotFound(wrongAgreementId)
      );
    });

    it("should throw an tenantIsNotTheConsumer if is not consumer", async () => {
      const authData = getMockAuthData();
      const organizationId = authData.organizationId;
      const agreement = getMockAgreement();

      const consumerDocument = getMockConsumerDocument(agreement.id);

      await addOneAgreement(agreement);

      const actualConsumerDocument = agreementService.addConsumerDocument(
        agreement.id,
        consumerDocument,
        getMockContext({ authData })
      );

      await expect(actualConsumerDocument).rejects.toThrowError(
        tenantIsNotTheConsumer(organizationId)
      );
    });

    it("should throw an tenantIsNotTheDelegateConsumer when the requester is the Consumer but there is a Consumer Delegation", async () => {
      const authData = getMockAuthData();
      const consumerId = unsafeBrandId<TenantId>(authData.organizationId);
      const agreement = getMockAgreement(generateId<EServiceId>(), consumerId);

      const consumerDocument = getMockConsumerDocument(agreement.id);

      await addOneAgreement(agreement);

      const delegation = getMockDelegation({
        kind: delegationKind.delegatedConsumer,
        delegateId: generateId<TenantId>(),
        delegatorId: agreement.consumerId,
        eserviceId: agreement.eserviceId,
        state: delegationState.active,
      });
      await addOneDelegation(delegation);
      await addSomeRandomDelegations(agreement, addOneDelegation);

      const actualConsumerDocument = agreementService.addConsumerDocument(
        agreement.id,
        consumerDocument,
        getMockContext({ authData })
      );

      await expect(actualConsumerDocument).rejects.toThrowError(
        tenantIsNotTheDelegateConsumer(consumerId, delegation.id)
      );
    });

    it("should throw a documentChangeNotAllowed if state not draft or pending", async () => {
      const authData = getMockAuthData();
      const organizationId = authData.organizationId;

      const agreementConsumerDocumentChangeFailureState = randomArrayItem(
        Object.values(agreementState).filter(
          (state) => !agreementConsumerDocumentChangeValidStates.includes(state)
        )
      );

      const agreement = getMockAgreement(
        generateId<EServiceId>(),
        organizationId,
        agreementConsumerDocumentChangeFailureState
      );

      const consumerDocument = getMockConsumerDocument(agreement.id);

      await addOneAgreement(agreement);

      const actualConsumerDocument = agreementService.addConsumerDocument(
        agreement.id,
        consumerDocument,
        getMockContext({ authData })
      );

      await expect(actualConsumerDocument).rejects.toThrowError(
        documentChangeNotAllowed(agreement.state)
      );
    });

    it("should throw a agreementDocumentAlreadyExists if document already exists", async () => {
      const authData = getMockAuthData();
      const organizationId = authData.organizationId;
      let agreement = getMockAgreement(
        generateId<EServiceId>(),
        organizationId
      );
      const consumerDocument = getMockConsumerDocument(agreement.id);
      agreement = {
        ...agreement,
        consumerDocuments: [consumerDocument],
      };

      await addOneAgreement(agreement);

      const actualConsumerDocument = agreementService.addConsumerDocument(
        agreement.id,
        consumerDocument,
        getMockContext({ authData })
      );
      await expect(actualConsumerDocument).rejects.toThrowError(
        agreementDocumentAlreadyExists(agreement.id)
      );
    });
  });

  describe("remove", () => {
    let agreement1: Agreement;
    beforeEach(async () => {
      const agreementId = generateId<AgreementId>();
      agreement1 = {
        ...getMockAgreement(),
        id: agreementId,
        consumerDocuments: [getMockConsumerDocument(agreementId, "doc1")],
      };

      await addOneAgreement(agreement1);
    });

    it("should succeed on happy path when the requester is the consumer", async () => {
      const authData = getMockAuthData(agreement1.consumerId);
      const consumerDocument = agreement1.consumerDocuments[0];

      await uploadDocument(
        agreement1.id,
        consumerDocument.id,
        consumerDocument.name
      );

      const removeAgreementConsumerDocumentResponse =
        await agreementService.removeAgreementConsumerDocument(
          agreement1.id,
          consumerDocument.id,
          getMockContext({ authData })
        );

      // Check that the file is removed from the bucket after removing it
      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).toMatchObject([]);

      const { data: payload } = await readLastAgreementEvent(agreement1.id);

      const actualConsumerDocument = decodeProtobufPayload({
        messageType: AgreementConsumerDocumentRemovedV2,
        payload,
      });

      const expectedAgreement = { ...agreement1, consumerDocuments: [] };

      expect({
        agreement: sortAgreementV2(actualConsumerDocument.agreement),
        documentId: actualConsumerDocument.documentId,
      }).toMatchObject({
        agreement: sortAgreementV2(toAgreementV2(expectedAgreement)),
        documentId: consumerDocument.id,
      });
      expect(sortAgreement(removeAgreementConsumerDocumentResponse)).toEqual({
        data: sortAgreement(expectedAgreement),
        metadata: {
          version: 1,
        },
      });
    });

    it("should succeed on happy path when the requester is the consumer delegate", async () => {
      const authData = getMockAuthData();
      const delegateId = authData.organizationId;

      const consumerDocument = agreement1.consumerDocuments[0];

      const delegation = getMockDelegation({
        kind: delegationKind.delegatedConsumer,
        eserviceId: agreement1.eserviceId,
        delegatorId: agreement1.consumerId,
        delegateId,
        state: delegationState.active,
      });

      await addOneDelegation(delegation);
      await addSomeRandomDelegations(agreement1, addOneDelegation);

      await uploadDocument(
        agreement1.id,
        consumerDocument.id,
        consumerDocument.name
      );

      const removeAgreementConsumerDocumentResponse =
        await agreementService.removeAgreementConsumerDocument(
          agreement1.id,
          consumerDocument.id,
          getMockContext({ authData })
        );

      expect(
        await fileManager.listFiles(config.s3Bucket, genericLogger)
      ).toMatchObject([]);

      const { data: payload } = await readLastAgreementEvent(agreement1.id);

      const actualConsumerDocument = decodeProtobufPayload({
        messageType: AgreementConsumerDocumentRemovedV2,
        payload,
      });

      const expectedAgreement = { ...agreement1, consumerDocuments: [] };

      expect({
        agreement: sortAgreementV2(actualConsumerDocument.agreement),
        documentId: actualConsumerDocument.documentId,
      }).toMatchObject({
        agreement: sortAgreementV2(toAgreementV2(expectedAgreement)),
        documentId: consumerDocument.id,
      });
      expect(sortAgreement(removeAgreementConsumerDocumentResponse)).toEqual({
        data: sortAgreement(expectedAgreement),
        metadata: {
          version: 1,
        },
      });
    });

    it("should throw tenantIsNotTheDelegateConsumer when the requester is the consumer but there is a consumer delegation", async () => {
      const authData = getMockAuthData(agreement1.consumerId);

      const delegation = getMockDelegation({
        kind: delegationKind.delegatedConsumer,
        eserviceId: agreement1.eserviceId,
        delegatorId: agreement1.consumerId,
        delegateId: generateId<TenantId>(),
        state: delegationState.active,
      });

      await addOneDelegation(delegation);

      await expect(
        agreementService.removeAgreementConsumerDocument(
          agreement1.id,
          agreement1.consumerDocuments[0].id,
          getMockContext({ authData })
        )
      ).rejects.toThrowError(
        tenantIsNotTheDelegateConsumer(authData.organizationId, delegation.id)
      );
    });

    it("should throw an agreementNotFound error when the agreement does not exist", async () => {
      const authData = getMockAuthData();
      const nonExistentAgreement = getMockAgreement();

      const removeAgreementConsumerDocument =
        agreementService.removeAgreementConsumerDocument(
          nonExistentAgreement.id,
          getMockConsumerDocument(nonExistentAgreement.id).id,
          getMockContext({ authData })
        );

      await expect(removeAgreementConsumerDocument).rejects.toThrowError(
        agreementNotFound(nonExistentAgreement.id)
      );
    });

    it("should throw an tenantIsNotTheConsumer if is not consumer", async () => {
      const authData = getMockAuthData();

      const removeAgreementConsumerDocument =
        agreementService.removeAgreementConsumerDocument(
          agreement1.id,
          agreement1.consumerDocuments[0].id,
          getMockContext({ authData })
        );

      await expect(removeAgreementConsumerDocument).rejects.toThrowError(
        tenantIsNotTheConsumer(authData.organizationId)
      );
    });

    it("should throw a documentChangeNotAllowed if state not draft or pending", async () => {
      const agreementConsumerDocumentChangeFailureState = randomArrayItem(
        Object.values(agreementState).filter(
          (state) => !agreementConsumerDocumentChangeValidStates.includes(state)
        )
      );
      const agreementId = generateId<AgreementId>();
      const anotherConsumerDocuments = [
        getMockConsumerDocument(agreementId, "doc2"),
      ];
      const agreement = {
        ...getMockAgreement(),
        id: agreementId,
        state: agreementConsumerDocumentChangeFailureState,
        consumerDocuments: anotherConsumerDocuments,
      };
      const authData = getMockAuthData(agreement.consumerId);

      await addOneAgreement(agreement);

      const removeAgreementConsumerDocument =
        agreementService.removeAgreementConsumerDocument(
          agreement.id,
          agreement.consumerDocuments[0].id,
          getMockContext({ authData })
        );

      await expect(removeAgreementConsumerDocument).rejects.toThrowError(
        documentChangeNotAllowed(agreement.state)
      );
    });

    it("should throw a agreementDocumentNotFound if document does not exist", async () => {
      const authData = getMockAuthData(agreement1.consumerId);
      const nonExistentDocumentId = generateId<AgreementDocumentId>();

      const removeAgreementConsumerDocument =
        agreementService.removeAgreementConsumerDocument(
          agreement1.id,
          nonExistentDocumentId,
          getMockContext({ authData })
        );
      await expect(removeAgreementConsumerDocument).rejects.toThrowError(
        agreementDocumentNotFound(nonExistentDocumentId, agreement1.id)
      );
    });

    it("should fail if the file deletion fails", async () => {
      // eslint-disable-next-line functional/immutable-data
      config.s3Bucket = "invalid-bucket"; // configure an invalid bucket to force a failure
      const authData = getMockAuthData(agreement1.consumerId);
      const consumerDocument = agreement1.consumerDocuments[0];

      await expect(
        agreementService.removeAgreementConsumerDocument(
          agreement1.id,
          consumerDocument.id,
          getMockContext({ authData })
        )
      ).rejects.toThrowError(
        fileManagerDeleteError(
          agreement1.consumerDocuments[0].path,
          config.s3Bucket,
          new Error("The specified bucket does not exist")
        )
      );
    });
  });
});
