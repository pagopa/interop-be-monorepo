import { describe, expect, it } from "vitest";
import { Agreement, WithMetadata } from "pagopa-interop-models";
import {
  getMockAgreementDocument,
  getMockAgreementStamp,
} from "pagopa-interop-commons-test";
import {
  agreementReadModelService,
  agreementWriterService,
  getCustomMockAgreement,
  retrieveAgreementAttributesSQLByAgreementId,
  retrieveAgreementConsumerDocumentSQLByAgreementId,
  retrieveAgreementContractSQLByAgreementId,
  retrieveAgreementStampsSQLByAgreementId,
} from "./utils.js";

describe("Agreement queries", () => {
  describe("upsertAgreement", () => {
    it("should add a complete (*all* fields) agreement", async () => {
      const agreement: WithMetadata<Agreement> = {
        data: {
          ...getCustomMockAgreement(),
          suspendedByConsumer: true,
          suspendedByProducer: false,
          suspendedByPlatform: false,
          updatedAt: new Date(),
          consumerNotes: "notes",
          contract: getMockAgreementDocument(),
          rejectionReason: "reason",
          suspendedAt: new Date(),
          stamps: {
            submission: getMockAgreementStamp(),
            activation: getMockAgreementStamp(),
            rejection: getMockAgreementStamp(),
            suspensionByProducer: getMockAgreementStamp(),
            suspensionByConsumer: getMockAgreementStamp(),
            upgrade: getMockAgreementStamp(),
            archiving: getMockAgreementStamp(),
          },
        },
        metadata: { version: 1 },
      };

      await agreementWriterService.upsertAgreement(agreement.data, 1);

      const retrievedAgreement =
        await agreementReadModelService.getAgreementById(agreement.data.id);

      const retrievedStamps = await retrieveAgreementStampsSQLByAgreementId(
        agreement.data.id
      );
      const retrievedAttributes =
        await retrieveAgreementAttributesSQLByAgreementId(agreement.data.id);
      const retrievedConsumerDocuments =
        await retrieveAgreementConsumerDocumentSQLByAgreementId(
          agreement.data.id
        );
      const retrievedContract = await retrieveAgreementContractSQLByAgreementId(
        agreement.data.id
      );

      expect(retrievedAgreement).toStrictEqual(agreement);
      expect(retrievedStamps).toHaveLength(7);
      expect(retrievedAttributes).toHaveLength(
        agreement.data.certifiedAttributes.length +
          agreement.data.declaredAttributes.length +
          agreement.data.verifiedAttributes.length
      );
      expect(retrievedConsumerDocuments).toHaveLength(
        agreement.data.consumerDocuments.length
      );
      expect(retrievedContract).toHaveLength(1);
    });

    it("should add an incomplete (*only* mandatory fields) agreement", async () => {
      const agreement: WithMetadata<Agreement> = {
        data: getCustomMockAgreement(),
        metadata: { version: 1 },
      };

      await agreementWriterService.upsertAgreement(agreement.data, 1);

      const retrievedAgreement =
        await agreementReadModelService.getAgreementById(agreement.data.id);

      const retrievedStamps = await retrieveAgreementStampsSQLByAgreementId(
        agreement.data.id
      );
      const retrievedAttributes =
        await retrieveAgreementAttributesSQLByAgreementId(agreement.data.id);
      const retrievedConsumerDocuments =
        await retrieveAgreementConsumerDocumentSQLByAgreementId(
          agreement.data.id
        );
      const retrievedContract = await retrieveAgreementContractSQLByAgreementId(
        agreement.data.id
      );

      expect(retrievedAgreement).toStrictEqual(agreement);
      expect(retrievedStamps).toHaveLength(7);
      expect(retrievedAttributes).toHaveLength(
        agreement.data.certifiedAttributes.length +
          agreement.data.declaredAttributes.length +
          agreement.data.verifiedAttributes.length
      );
      expect(retrievedConsumerDocuments).toHaveLength(
        agreement.data.consumerDocuments.length
      );
      expect(retrievedContract).toHaveLength(0);
    });

    it("should update a complete (*all* fields) agreement", async () => {
      const agreement: WithMetadata<Agreement> = {
        data: {
          ...getCustomMockAgreement(),
          suspendedByConsumer: true,
          suspendedByProducer: false,
          suspendedByPlatform: false,
          updatedAt: new Date(),
          consumerNotes: "notes",
          contract: getMockAgreementDocument(),
          rejectionReason: "reason",
          suspendedAt: new Date(),
          stamps: {
            submission: getMockAgreementStamp(),
            activation: getMockAgreementStamp(),
            rejection: getMockAgreementStamp(),
            suspensionByProducer: getMockAgreementStamp(),
            suspensionByConsumer: getMockAgreementStamp(),
            upgrade: getMockAgreementStamp(),
            archiving: getMockAgreementStamp(),
          },
        },
        metadata: { version: 1 },
      };

      const updatedAgreement: WithMetadata<Agreement> = {
        data: { ...agreement.data, updatedAt: new Date() },
        metadata: { version: 2 },
      };

      await agreementWriterService.upsertAgreement(
        agreement.data,
        agreement.metadata.version
      );

      await agreementWriterService.upsertAgreement(
        updatedAgreement.data,
        updatedAgreement.metadata.version
      );

      const retrievedAgreement =
        await agreementReadModelService.getAgreementById(
          updatedAgreement.data.id
        );

      const retrievedStamps = await retrieveAgreementStampsSQLByAgreementId(
        updatedAgreement.data.id
      );
      const retrievedAttributes =
        await retrieveAgreementAttributesSQLByAgreementId(
          updatedAgreement.data.id
        );
      const retrievedConsumerDocuments =
        await retrieveAgreementConsumerDocumentSQLByAgreementId(
          updatedAgreement.data.id
        );
      const retrievedContract = await retrieveAgreementContractSQLByAgreementId(
        updatedAgreement.data.id
      );

      expect(retrievedAgreement).toStrictEqual(updatedAgreement);
      expect(retrievedStamps).toHaveLength(7);
      expect(retrievedAttributes).toHaveLength(
        updatedAgreement.data.certifiedAttributes.length +
          updatedAgreement.data.declaredAttributes.length +
          updatedAgreement.data.verifiedAttributes.length
      );
      expect(retrievedConsumerDocuments).toHaveLength(
        updatedAgreement.data.consumerDocuments.length
      );
      expect(retrievedContract).toHaveLength(1);
    });
  });

  describe("deleteAgreementById", () => {
    it("delete one agreement", async () => {
      const agreement: WithMetadata<Agreement> = {
        data: getCustomMockAgreement(),
        metadata: { version: 1 },
      };

      await agreementWriterService.upsertAgreement(
        agreement.data,
        agreement.metadata.version
      );

      await agreementWriterService.deleteAgreementById(
        agreement.data.id,
        agreement.metadata.version
      );
      const retrievedAgreement =
        await agreementReadModelService.getAgreementById(agreement.data.id);
      const retrievedStamps = await retrieveAgreementStampsSQLByAgreementId(
        agreement.data.id
      );
      const retrievedAttributes =
        await retrieveAgreementAttributesSQLByAgreementId(agreement.data.id);
      const retrievedConsumerDocuments =
        await retrieveAgreementConsumerDocumentSQLByAgreementId(
          agreement.data.id
        );
      const retrievedContract = await retrieveAgreementContractSQLByAgreementId(
        agreement.data.id
      );

      expect(retrievedAgreement).toBeUndefined();
      expect(retrievedStamps).toStrictEqual([]);
      expect(retrievedAttributes).toStrictEqual([]);
      expect(retrievedConsumerDocuments).toStrictEqual([]);
      expect(retrievedContract).toStrictEqual([]);
    });
  });
});
