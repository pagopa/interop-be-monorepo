/* eslint-disable functional/no-let */
import { generateMock } from "@anatine/zod-mock";
import {
  getMockAgreement,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import {
  Agreement,
  AgreementDocument,
  generateId,
  AgreementId,
  TenantId,
  AgreementDocumentId,
} from "pagopa-interop-models";
import { genericLogger } from "pagopa-interop-commons";
import { describe, beforeEach, it, expect } from "vitest";
import {
  agreementNotFound,
  operationNotAllowed,
  agreementDocumentNotFound,
} from "../src/model/domain/errors.js";
import {
  postgresDB,
  agreements,
  agreementService,
} from "./agreementService.integration.test.js";
import { addOneAgreement } from "./utils.js";

export const testAgreementConsumerDocuments = (): ReturnType<typeof describe> =>
  describe("get agreement consumer document", () => {
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

    it("should get an agreement consumer document when the requester is the consumer or producer", async () => {
      const authData = getRandomAuthData(
        randomArrayItem([agreement1.consumerId, agreement1.producerId])
      );
      const result = await agreementService.getAgreementConsumerDocument(
        agreement1.id,
        agreement1.consumerDocuments[0].id,
        authData,
        genericLogger
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
          authData,
          genericLogger
        )
      ).rejects.toThrowError(agreementNotFound(agreementId));
    });

    it("should throw an operationNotAllowed error when the requester is not the consumer or producer", async () => {
      const authData = getRandomAuthData(generateId<TenantId>());

      await expect(
        agreementService.getAgreementConsumerDocument(
          agreement1.id,
          agreement1.consumerDocuments[0].id,
          authData,
          genericLogger
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
          authData,
          genericLogger
        )
      ).rejects.toThrowError(
        agreementDocumentNotFound(agreementDocumentId, agreement1.id)
      );
    });
  });
