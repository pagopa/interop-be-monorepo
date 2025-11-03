/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  getMockAgreement,
  getMockAgreementAttribute,
  getMockAgreementDocument,
  getMockAgreementStamps,
} from "pagopa-interop-commons-test";
import { describe, it, expect } from "vitest";
import {
  Agreement,
  AgreementDocument,
  AgreementSignedContract,
  AgreementStamp,
  AgreementStampKind,
  AgreementStamps,
  attributeKind,
  DelegationId,
  generateId,
  UserId,
} from "pagopa-interop-models";
import {
  AgreementAttributeSQL,
  AgreementConsumerDocumentSQL,
  AgreementContractSQL,
  AgreementSQL,
  AgreementSignedContractSQL,
  AgreementStampSQL,
} from "pagopa-interop-readmodel-models";
import { splitAgreementIntoObjectsSQL } from "../src/agreement/splitters.js";

describe("Agreement Splitter", () => {
  it.each([
    { consumerNotes: "", rejectionReason: "" },
    { consumerNotes: "consumer notes", rejectionReason: "rejection reason" },
  ])(
    "should convert an Agreement object as business model into a Agreement object as data model",
    ({ consumerNotes, rejectionReason }) => {
      // set an Agreement
      const verifiedAttribute = getMockAgreementAttribute();
      const certifiedAttribute = getMockAgreementAttribute();
      const declaredAttribute = getMockAgreementAttribute();
      const consumerDocument = getMockAgreementDocument();
      const contract: AgreementDocument = {
        ...getMockAgreementDocument(),
        createdAt: new Date(),
      };

      const signedContract: AgreementSignedContract = {
        ...getMockAgreementDocument(),
        createdAt: new Date(),
        signedAt: new Date(),
      };

      const mockAgreementStamps = getMockAgreementStamps();
      const agreementStamps: AgreementStamps = {};
      const delegationId = generateId<DelegationId>();

      // eslint-disable-next-line functional/no-let
      let key: keyof AgreementStamps;

      // eslint-disable-next-line guard-for-in
      for (key in mockAgreementStamps) {
        const mockStamp = mockAgreementStamps[key];
        if (mockStamp) {
          // eslint-disable-next-line functional/immutable-data
          agreementStamps[key] = {
            ...mockStamp,
            when: new Date(),
            delegationId,
          };
        }
      }

      const agreement: Agreement = {
        ...getMockAgreement(),
        verifiedAttributes: [verifiedAttribute],
        certifiedAttributes: [certifiedAttribute],
        declaredAttributes: [declaredAttribute],
        suspendedByConsumer: true,
        suspendedByProducer: true,
        suspendedByPlatform: true,
        consumerDocuments: [consumerDocument],
        updatedAt: new Date(),
        consumerNotes,
        contract,
        stamps: agreementStamps,
        rejectionReason,
        suspendedAt: new Date(),
      };
      // convert an agreement into a specific agreement data model
      const {
        agreementSQL,
        consumerDocumentsSQL,
        contractSQL,
        attributesSQL,
        stampsSQL,
        signedContractSQL,
      } = splitAgreementIntoObjectsSQL(agreement, 1);

      const expectedAgreementSQL: AgreementSQL = {
        metadataVersion: 1,
        id: agreement.id,
        eserviceId: agreement.eserviceId,
        descriptorId: agreement.descriptorId,
        producerId: agreement.producerId,
        consumerId: agreement.consumerId,
        state: agreement.state,
        suspendedByConsumer: true,
        suspendedByProducer: true,
        suspendedByPlatform: true,
        createdAt: agreement.createdAt.toISOString(),
        updatedAt: agreement.updatedAt!.toISOString(),
        consumerNotes,
        rejectionReason,
        suspendedAt: agreement.suspendedAt!.toISOString(),
      };

      const expectedAgreementConsumerDocumentSQL: AgreementConsumerDocumentSQL =
        {
          ...consumerDocument,
          agreementId: agreement.id,
          metadataVersion: 1,
          createdAt: consumerDocument.createdAt.toISOString(),
        };

      const expectedContractDocumentSQL: AgreementContractSQL = {
        ...contract,
        agreementId: agreement.id,
        metadataVersion: 1,
        createdAt: contract.createdAt.toISOString(),
      };
      const expectedSignedContractDocumentSQL: AgreementSignedContractSQL = {
        ...signedContract,
        agreementId: agreement.id,
        metadataVersion: 1,
        createdAt: signedContract.createdAt.toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
        signedAt: signedContract.signedAt?.toISOString()!,
      };

      const expectedAgreementVerifiedAttributeSQL: AgreementAttributeSQL = {
        metadataVersion: 1,
        agreementId: agreement.id,
        kind: attributeKind.verified,
        attributeId: verifiedAttribute.id,
      };
      const expectedAgreementCertifiedAttributeSQL: AgreementAttributeSQL = {
        metadataVersion: 1,
        agreementId: agreement.id,
        kind: attributeKind.certified,
        attributeId: certifiedAttribute.id,
      };
      const expectedAgreementDeclaredAttributeSQL: AgreementAttributeSQL = {
        metadataVersion: 1,
        agreementId: agreement.id,
        kind: attributeKind.declared,
        attributeId: declaredAttribute.id,
      };

      const expectedAgreementStampsSQL: AgreementStampSQL[] = [];
      // eslint-disable-next-line guard-for-in
      for (key in agreementStamps) {
        const stamp = agreementStamps[key];
        if (stamp) {
          // eslint-disable-next-line functional/immutable-data
          expectedAgreementStampsSQL.push({
            agreementId: agreement.id,
            metadataVersion: 1,
            kind: AgreementStampKind.enum[key],
            who: stamp.who,
            when: stamp.when.toISOString(),
            delegationId,
          });
        }
      }

      expect(agreementSQL).toStrictEqual(expectedAgreementSQL);
      expect(consumerDocumentsSQL).toStrictEqual([
        expectedAgreementConsumerDocumentSQL,
      ]);
      expect(contractSQL).toStrictEqual(expectedContractDocumentSQL);
      expect(signedContractSQL).toStrictEqual(
        expectedSignedContractDocumentSQL
      );
      expect(attributesSQL).toStrictEqual(
        expect.arrayContaining([
          expectedAgreementVerifiedAttributeSQL,
          expectedAgreementCertifiedAttributeSQL,
          expectedAgreementDeclaredAttributeSQL,
        ])
      );
      expect(stampsSQL).toStrictEqual(expectedAgreementStampsSQL);
    }
  );

  it("should convert an Agreement object with undefined values as business model into an Agreement object with null values as data model", () => {
    // set an Agreement
    const verifiedAttribute = getMockAgreementAttribute();
    const certifiedAttribute = getMockAgreementAttribute();
    const declaredAttribute = getMockAgreementAttribute();
    const consumerDocument = getMockAgreementDocument();
    const agreementSubmissionStamp: AgreementStamp = {
      who: generateId<UserId>(),
      when: new Date(),
      delegationId: undefined,
    };
    const agreementStamps: AgreementStamps = {
      submission: agreementSubmissionStamp,
      activation: undefined,
      rejection: undefined,
      suspensionByProducer: undefined,
      suspensionByConsumer: undefined,
      upgrade: undefined,
      archiving: undefined,
    };

    const agreement: Agreement = {
      ...getMockAgreement(),
      verifiedAttributes: [verifiedAttribute],
      certifiedAttributes: [certifiedAttribute],
      declaredAttributes: [declaredAttribute],
      suspendedByConsumer: undefined,
      suspendedByProducer: undefined,
      suspendedByPlatform: undefined,
      consumerDocuments: [consumerDocument],
      updatedAt: undefined,
      consumerNotes: undefined,
      contract: undefined,
      stamps: agreementStamps,
      rejectionReason: undefined,
      suspendedAt: undefined,
    };
    // convert an agreement into a specific agreement data model
    const {
      agreementSQL,
      consumerDocumentsSQL,
      contractSQL,
      attributesSQL,
      stampsSQL,
    } = splitAgreementIntoObjectsSQL(agreement, 1);

    const expectedAgreementSQL: AgreementSQL = {
      metadataVersion: 1,
      id: agreement.id,
      eserviceId: agreement.eserviceId,
      descriptorId: agreement.descriptorId,
      producerId: agreement.producerId,
      consumerId: agreement.consumerId,
      state: agreement.state,
      suspendedByConsumer: null,
      suspendedByProducer: null,
      suspendedByPlatform: null,
      createdAt: agreement.createdAt.toISOString(),
      updatedAt: null,
      consumerNotes: null,
      rejectionReason: null,
      suspendedAt: null,
    };

    const expectedAgreementConsumerDocumentSQL: AgreementConsumerDocumentSQL = {
      ...consumerDocument,
      agreementId: agreement.id,
      metadataVersion: 1,
      createdAt: consumerDocument.createdAt.toISOString(),
    };
    const expectedAgreementVerifiedAttributeSQL: AgreementAttributeSQL = {
      metadataVersion: 1,
      agreementId: agreement.id,
      kind: attributeKind.verified,
      attributeId: verifiedAttribute.id,
    };
    const expectedAgreementCertifiedAttributeSQL: AgreementAttributeSQL = {
      metadataVersion: 1,
      agreementId: agreement.id,
      kind: attributeKind.certified,
      attributeId: certifiedAttribute.id,
    };
    const expectedAgreementDeclaredAttributeSQL: AgreementAttributeSQL = {
      metadataVersion: 1,
      agreementId: agreement.id,
      kind: attributeKind.declared,
      attributeId: declaredAttribute.id,
    };
    const expectedAgreementStampsSQL: AgreementStampSQL[] = [
      {
        metadataVersion: 1,
        agreementId: agreement.id,
        kind: AgreementStampKind.enum.submission,
        who: agreementSubmissionStamp.who,
        when: agreementSubmissionStamp.when.toISOString(),
        delegationId: null,
      },
    ];

    expect(agreementSQL).toStrictEqual(expectedAgreementSQL);
    expect(consumerDocumentsSQL).toStrictEqual([
      expectedAgreementConsumerDocumentSQL,
    ]);
    expect(contractSQL).toBeUndefined();
    expect(attributesSQL).toStrictEqual(
      expect.arrayContaining([
        expectedAgreementVerifiedAttributeSQL,
        expectedAgreementCertifiedAttributeSQL,
        expectedAgreementDeclaredAttributeSQL,
      ])
    );
    expect(stampsSQL).toStrictEqual(expectedAgreementStampsSQL);
  });
});
