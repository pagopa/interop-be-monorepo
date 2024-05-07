/* eslint-disable functional/no-let */
import { generateMock } from "@anatine/zod-mock";
import { fileManagerDeleteError } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAgreement,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
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
  generateId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it } from "vitest";
import {
  agreementDocumentAlreadyExists,
  agreementDocumentNotFound,
  agreementNotFound,
  documentChangeNotAllowed,
  operationNotAllowed,
} from "../src/model/domain/errors.js";
import { agreementConsumerDocumentChangeValidStates } from "../src/model/domain/validators.js";
import { config } from "../src/utilities/config.js";
import { toAgreementV2 } from "../src/model/domain/toEvent.js";
import {
  agreementService,
  agreements,
  fileManager,
  postgresDB,
} from "./agreementService.integration.test.js";
import {
  addOneAgreement,
  getMockConsumerDocument,
  readLastAgreementEvent,
} from "./utils.js";

export const testAgreementConsumerDocuments = (): ReturnType<typeof describe> =>
  describe("agreement consumer document", () => {
    describe("get", () => {
      let agreement1: Agreement;

      beforeEach(async () => {
        agreement1 = {
          ...getMockAgreement(),
          consumerDocuments: [
            generateMock(AgreementDocument),
            generateMock(AgreementDocument),
          ],
        };

        await addOneAgreement(agreement1, postgresDB, agreements);
        await addOneAgreement(getMockAgreement(), postgresDB, agreements);
      });

      it("should succed when the requester is the consumer or producer", async () => {
        const authData = getRandomAuthData(
          randomArrayItem([agreement1.consumerId, agreement1.producerId])
        );
        const result = await agreementService.getAgreementConsumerDocument(
          agreement1.id,
          agreement1.consumerDocuments[0].id,
          authData
        );

        expect(result).toEqual(agreement1.consumerDocuments[0]);
      });

      it("should throw an agreementNotFound error when the agreement does not exist", async () => {
        const agreementId = generateId<AgreementId>();
        const authData = getRandomAuthData(agreement1.consumerId);
        await addOneAgreement(getMockAgreement(), postgresDB, agreements);
        await expect(
          agreementService.getAgreementConsumerDocument(
            agreementId,
            agreement1.consumerDocuments[0].id,
            authData
          )
        ).rejects.toThrowError(agreementNotFound(agreementId));
      });

      it("should throw an operationNotAllowed error when the requester is not the consumer or producer", async () => {
        const authData = getRandomAuthData(generateId<TenantId>());

        await expect(
          agreementService.getAgreementConsumerDocument(
            agreement1.id,
            agreement1.consumerDocuments[0].id,
            authData
          )
        ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
      });

      it("should throw an agreementDocumentNotFound error when the document does not exist", async () => {
        const authData = getRandomAuthData(agreement1.consumerId);
        const agreementDocumentId = generateId<AgreementDocumentId>();
        await expect(
          agreementService.getAgreementConsumerDocument(
            agreement1.id,
            agreementDocumentId,
            authData
          )
        ).rejects.toThrowError(
          agreementDocumentNotFound(agreementDocumentId, agreement1.id)
        );
      });
    });

    describe("add", () => {
      it("should succeed on happy path", async () => {
        const authData = getRandomAuthData();
        const organizationId = authData.organizationId;
        const agreement = getMockAgreement(
          generateId<EServiceId>(),
          organizationId
        );

        const consumerDocument = getMockConsumerDocument(agreement.id);

        await addOneAgreement(agreement, postgresDB, agreements);

        await agreementService.addConsumerDocument(
          agreement.id,
          consumerDocument,
          authData,
          generateId()
        );
        const { data: payload } = await readLastAgreementEvent(
          agreement.id,
          postgresDB
        );

        const actualConsumerDocument = decodeProtobufPayload({
          messageType: AgreementConsumerDocumentAddedV2,
          payload,
        });

        const expectedConsumerDocument: AgreementDocument = {
          ...consumerDocument,
          createdAt: new Date(
            Number(
              actualConsumerDocument.agreement?.consumerDocuments.at(-1)
                ?.createdAt ?? 0
            )
          ),
        };
        const expectedAgreement = {
          ...agreement,
          consumerDocuments: [
            ...agreement.consumerDocuments,
            expectedConsumerDocument,
          ],
        };

        expect(actualConsumerDocument).toMatchObject({
          agreement: toAgreementV2(expectedAgreement),
          documentId: consumerDocument.id,
        });
      });

      it("should throw an agreementNotFound error when the agreement does not exist", async () => {
        const authData = getRandomAuthData();
        await addOneAgreement(getMockAgreement(), postgresDB, agreements);

        const wrongAgreementId = generateId<AgreementId>();
        const consumerDocument = getMockConsumerDocument(wrongAgreementId);
        const actualConsumerDocument = agreementService.addConsumerDocument(
          wrongAgreementId,
          consumerDocument,
          authData,
          generateId()
        );

        await expect(actualConsumerDocument).rejects.toThrowError(
          agreementNotFound(wrongAgreementId)
        );
      });

      it("should throw an operationNotAllowed if is not consumer", async () => {
        const authData = getRandomAuthData();
        const organizationId = authData.organizationId;
        const agreement = getMockAgreement();

        const consumerDocument = getMockConsumerDocument(agreement.id);

        await addOneAgreement(agreement, postgresDB, agreements);

        const actualConsumerDocument = agreementService.addConsumerDocument(
          agreement.id,
          consumerDocument,
          authData,
          generateId()
        );

        await expect(actualConsumerDocument).rejects.toThrowError(
          operationNotAllowed(organizationId)
        );
      });

      it("should throw a documentChangeNotAllowed if state not draft or pending", async () => {
        const authData = getRandomAuthData();
        const organizationId = authData.organizationId;

        const agreementConsumerDocumentChangeFailureState = randomArrayItem(
          Object.values(agreementState).filter(
            (state) =>
              !agreementConsumerDocumentChangeValidStates.includes(state)
          )
        );

        const agreement = getMockAgreement(
          generateId<EServiceId>(),
          organizationId,
          agreementConsumerDocumentChangeFailureState
        );

        const consumerDocument = getMockConsumerDocument(agreement.id);

        await addOneAgreement(agreement, postgresDB, agreements);

        const actualConsumerDocument = agreementService.addConsumerDocument(
          agreement.id,
          consumerDocument,
          authData,
          generateId()
        );

        await expect(actualConsumerDocument).rejects.toThrowError(
          documentChangeNotAllowed(agreement.state)
        );
      });

      it("should throw a agreementDocumentAlreadyExists if document already exists", async () => {
        const authData = getRandomAuthData();
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

        await addOneAgreement(agreement, postgresDB, agreements);

        const actualConsumerDocument = agreementService.addConsumerDocument(
          agreement.id,
          consumerDocument,
          authData,
          generateId()
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

        await addOneAgreement(agreement1, postgresDB, agreements);
      });

      it("should succeed on happy path", async () => {
        const authData = getRandomAuthData(agreement1.consumerId);
        const consumerDocument = agreement1.consumerDocuments[0];

        await fileManager.storeBytes(
          config.s3Bucket,
          `${config.consumerDocumentsPath}/${agreement1.id}`,
          agreement1.consumerDocuments[0].id,
          agreement1.consumerDocuments[0].name,
          Buffer.from("test content")
        );

        // Check that the file is stored in the bucket before removing it
        expect(await fileManager.listFiles(config.s3Bucket)).toContain(
          agreement1.consumerDocuments[0].path
        );

        await agreementService.removeAgreementConsumerDocument(
          agreement1.id,
          consumerDocument.id,
          authData,
          generateId()
        );

        // Check that the file is removed from the bucket after removing it
        expect(await fileManager.listFiles(config.s3Bucket)).toMatchObject([]);

        const { data: payload } = await readLastAgreementEvent(
          agreement1.id,
          postgresDB
        );

        const actualConsumerDocument = decodeProtobufPayload({
          messageType: AgreementConsumerDocumentRemovedV2,
          payload,
        });

        const expectedAgreement = { ...agreement1, consumerDocuments: [] };

        expect(actualConsumerDocument).toMatchObject({
          agreement: toAgreementV2(expectedAgreement),
          documentId: consumerDocument.id,
        });
      });

      it("should throw an agreementNotFound error when the agreement does not exist", async () => {
        const authData = getRandomAuthData();
        const notExistentAgreement = getMockAgreement();

        const removeAgreementConsumerDocument =
          agreementService.removeAgreementConsumerDocument(
            notExistentAgreement.id,
            getMockConsumerDocument(notExistentAgreement.id).id,
            authData,
            generateId()
          );

        await expect(removeAgreementConsumerDocument).rejects.toThrowError(
          agreementNotFound(notExistentAgreement.id)
        );
      });

      it("should throw an operationNotAllowed if is not consumer", async () => {
        const authData = getRandomAuthData();

        const removeAgreementConsumerDocument =
          agreementService.removeAgreementConsumerDocument(
            agreement1.id,
            agreement1.consumerDocuments[0].id,
            authData,
            generateId()
          );

        await expect(removeAgreementConsumerDocument).rejects.toThrowError(
          operationNotAllowed(authData.organizationId)
        );
      });

      it("should throw a documentChangeNotAllowed if state not draft or pending", async () => {
        const authData = getRandomAuthData(agreement1.consumerId);

        const agreementConsumerDocumentChangeFailureState = randomArrayItem(
          Object.values(agreementState).filter(
            (state) =>
              !agreementConsumerDocumentChangeValidStates.includes(state)
          )
        );
        const agreement = {
          ...agreement1,
          id: generateId<AgreementId>(),
          state: agreementConsumerDocumentChangeFailureState,
        };

        await addOneAgreement(agreement, postgresDB, agreements);

        const removeAgreementConsumerDocument =
          agreementService.removeAgreementConsumerDocument(
            agreement.id,
            agreement.consumerDocuments[0].id,
            authData,
            generateId()
          );

        await expect(removeAgreementConsumerDocument).rejects.toThrowError(
          documentChangeNotAllowed(agreement.state)
        );
      });

      it("should throw a agreementDocumentNotFound if document does not exist", async () => {
        const authData = getRandomAuthData(agreement1.consumerId);
        const notExistendDocumentId = generateId<AgreementDocumentId>();

        const removeAgreementConsumerDocument =
          agreementService.removeAgreementConsumerDocument(
            agreement1.id,
            notExistendDocumentId,
            authData,
            generateId()
          );
        await expect(removeAgreementConsumerDocument).rejects.toThrowError(
          agreementDocumentNotFound(notExistendDocumentId, agreement1.id)
        );
      });

      it("should fail if the file deletion fails", async () => {
        // eslint-disable-next-line functional/immutable-data
        config.s3Bucket = "invalid-bucket"; // configure an invalid bucket to force a failure
        const authData = getRandomAuthData(agreement1.consumerId);
        const consumerDocument = agreement1.consumerDocuments[0];

        await expect(
          agreementService.removeAgreementConsumerDocument(
            agreement1.id,
            consumerDocument.id,
            authData,
            generateId()
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
