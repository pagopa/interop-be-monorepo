/* eslint-disable functional/no-let */
import { generateMock } from "@anatine/zod-mock";
import { AuthData } from "pagopa-interop-commons";
import {
  decodeProtobufPayload,
  getMockAgreement,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import {
  Agreement,
  AgreementConsumerDocumentAddedV1,
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
import {
  agreementService,
  agreements,
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
        const organizationId = generateId<TenantId>();
        const authData: AuthData = {
          ...getRandomAuthData(organizationId),
          userRoles: ["admin"],
        };
        const agreement = getMockAgreement(
          generateId<EServiceId>(),
          organizationId
        );

        const consumerDocument = getMockConsumerDocument(agreement.id);
        const correlationId = "9999";

        await addOneAgreement(agreement, postgresDB, agreements);

        await agreementService.addConsumerDocument(
          agreement.id,
          consumerDocument,
          authData,
          correlationId
        );
        const { data: payload } = await readLastAgreementEvent(
          agreement.id,
          postgresDB
        );

        const actualConsumerDocument = decodeProtobufPayload({
          messageType: AgreementConsumerDocumentAddedV1,
          payload,
        });

        expect(actualConsumerDocument).toMatchObject({
          agreementId: agreement.id,
          document: {
            ...consumerDocument,
            createdAt: actualConsumerDocument.document?.createdAt,
          },
        });
      });

      it("should throw an agreementNotFound error when the agreement does not exist", async () => {
        const organizationId = generateId<TenantId>();
        const authData: AuthData = {
          ...getRandomAuthData(organizationId),
          userRoles: ["admin"],
        };
        const agreement = getMockAgreement(
          generateId<EServiceId>(),
          organizationId
        );

        const consumerDocument = getMockConsumerDocument(agreement.id);
        const correlationId = "9999";

        await addOneAgreement(agreement, postgresDB, agreements);

        const wrongAgreementId = generateId<AgreementId>();
        const actualConsumerDocument = agreementService.addConsumerDocument(
          wrongAgreementId,
          consumerDocument,
          authData,
          correlationId
        );

        await expect(actualConsumerDocument).rejects.toThrowError(
          agreementNotFound(wrongAgreementId)
        );
      });

      it("should throw an operationNotAllowed if is not consumer", async () => {
        const organizationId = generateId<TenantId>();
        const authData: AuthData = {
          ...getRandomAuthData(organizationId),
          userRoles: ["admin"],
        };
        const agreement = getMockAgreement();

        const consumerDocument = getMockConsumerDocument(agreement.id);
        const correlationId = "9999";

        await addOneAgreement(agreement, postgresDB, agreements);

        const actualConsumerDocument = agreementService.addConsumerDocument(
          agreement.id,
          consumerDocument,
          authData,
          correlationId
        );

        await expect(actualConsumerDocument).rejects.toThrowError(
          operationNotAllowed(authData.organizationId)
        );
      });

      it("should throw a documentChangeNotAllowed if state not draft or pending", async () => {
        const organizationId = generateId<TenantId>();
        const authData: AuthData = {
          ...getRandomAuthData(organizationId),
          userRoles: ["admin"],
        };
        const agreement = getMockAgreement(
          generateId<EServiceId>(),
          organizationId,
          agreementState.active
        );
        const consumerDocument = getMockConsumerDocument(agreement.id);
        const correlationId = "9999";

        await addOneAgreement(agreement, postgresDB, agreements);

        const actualConsumerDocument = agreementService.addConsumerDocument(
          agreement.id,
          consumerDocument,
          authData,
          correlationId
        );

        await expect(actualConsumerDocument).rejects.toThrowError(
          documentChangeNotAllowed(agreement.state)
        );
      });

      it("should throw a agreementDocumentAlreadyExists if document already exists", async () => {
        const organizationId = generateId<TenantId>();
        const authData: AuthData = {
          ...getRandomAuthData(organizationId),
          userRoles: ["admin"],
        };
        let agreement = getMockAgreement(
          generateId<EServiceId>(),
          organizationId
        );
        const consumerDocument = getMockConsumerDocument(agreement.id);
        agreement = {
          ...agreement,
          consumerDocuments: [consumerDocument],
        };
        const correlationId = "9999";

        await addOneAgreement(agreement, postgresDB, agreements);

        const actualConsumerDocument = agreementService.addConsumerDocument(
          agreement.id,
          consumerDocument,
          authData,
          correlationId
        );
        await expect(actualConsumerDocument).rejects.toThrowError(
          agreementDocumentAlreadyExists(agreement.id)
        );
      });
    });
  });
