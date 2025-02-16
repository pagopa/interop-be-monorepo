/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  getMockAgreement,
  getMockAgreementAttribute,
  getMockAgreementDocument,
  getMockAgreementStamps,
} from "pagopa-interop-commons-test/index.js";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import {
  agreementDocumentKind,
  AgreementStamp,
  agreementStampKind,
  AgreementStamps,
  attributeKind,
  DelegationId,
  generateId,
  UserId,
} from "pagopa-interop-models";
import {
  AgreementAttributeSQL,
  AgreementDocumentSQL,
  AgreementSQL,
  AgreementStampSQL,
} from "../src/types.js";
import { splitAgreementIntoObjectsSQL } from "./../src/agreement/splitters.js";

describe("Agreement Splitter", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should convert an Agreement object as business model into a Agreement object as data model", () => {
    // set an Agreement
    const verifiedAttribute = getMockAgreementAttribute();
    const certifiedAttribute = getMockAgreementAttribute();
    const declareddAttribute = getMockAgreementAttribute();
    const consumerDocument = getMockAgreementDocument();
    const contract = {
      ...getMockAgreementDocument(),
      createdAt: new Date(),
    };
    const consumerNotes = "some notes";
    const rejectionReason = "some rejection reason";

    const mockAgreemenStamps = getMockAgreementStamps();
    const agreemenStamps: AgreementStamps = {};
    const delegationId = generateId<DelegationId>();

    // eslint-disable-next-line functional/no-let
    let key: keyof AgreementStamps;

    // eslint-disable-next-line guard-for-in
    for (key in mockAgreemenStamps) {
      const mockStamp = mockAgreemenStamps[key];
      if (mockStamp) {
        // eslint-disable-next-line functional/immutable-data
        agreemenStamps[key] = {
          ...mockStamp,
          when: new Date(),
          delegationId,
        };
      }
    }

    const agreement = {
      ...getMockAgreement(),
      verifiedAttributes: [verifiedAttribute],
      certifiedAttributes: [certifiedAttribute],
      declaredAttributes: [declareddAttribute],
      suspendedByConsumer: true,
      suspendedByProducer: true,
      suspendedByPlatform: true,
      consumerDocuments: [consumerDocument],
      updatedAt: new Date(),
      consumerNotes,
      contract,
      stamps: agreemenStamps,
      rejectionReason,
      suspendedAt: new Date(),
    };
    // convert an agreement into a specific agreement data model
    const {
      agreementSQL,
      agreementDocumentsSQL,
      agreementAttributesSQL,
      agreementStampsSQL,
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
      updatedAt: new Date().toISOString(),
      consumerNotes,
      rejectionReason,
      suspendedAt: new Date().toISOString(),
    };

    const expectedAgreementDocumentSQL: AgreementDocumentSQL = {
      ...consumerDocument,
      agreementId: agreement.id,
      metadataVersion: 1,
      kind: agreementDocumentKind.consumerDoc,
      createdAt: consumerDocument.createdAt.toISOString(),
    };

    const expectedContracDocumentSQL: AgreementDocumentSQL = {
      ...contract,
      agreementId: agreement.id,
      metadataVersion: 1,
      kind: agreementDocumentKind.contract,
      createdAt: contract.createdAt.toISOString(),
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
      attributeId: declareddAttribute.id,
    };

    const expectedAgreementStampsSQL: AgreementStampSQL[] = [];
    // eslint-disable-next-line guard-for-in
    for (key in agreemenStamps) {
      const stamp = agreemenStamps[key];
      if (stamp) {
        // eslint-disable-next-line functional/immutable-data
        expectedAgreementStampsSQL.push({
          agreementId: agreement.id,
          metadataVersion: 1,
          kind: agreementStampKind[key],
          who: stamp.who,
          when: stamp.when.toISOString(),
          delegationId,
        });
      }
    }

    expect(agreementSQL).toEqual(expectedAgreementSQL);
    expect(agreementDocumentsSQL).toEqual(
      expect.arrayContaining([
        expectedAgreementDocumentSQL,
        expectedContracDocumentSQL,
      ])
    );
    expect(agreementAttributesSQL).toEqual(
      expect.arrayContaining([
        expectedAgreementVerifiedAttributeSQL,
        expectedAgreementCertifiedAttributeSQL,
        expectedAgreementDeclaredAttributeSQL,
      ])
    );
    expect(agreementStampsSQL).toEqual(expectedAgreementStampsSQL);
  });

  it("should convert an Agreement object with undefined values as business model into an Agreement object with null values as data model", () => {
    // set an Agreement
    const verifiedAttribute = getMockAgreementAttribute();
    const certifiedAttribute = getMockAgreementAttribute();
    const declareddAttribute = getMockAgreementAttribute();
    const consumerDocument = getMockAgreementDocument();
    const agreementSubmissionStamp: AgreementStamp = {
      who: generateId<UserId>(),
      when: new Date(),
      delegationId: undefined,
    };
    const agreemenStamps: AgreementStamps = {
      submission: agreementSubmissionStamp,
      activation: undefined,
      rejection: undefined,
      suspensionByProducer: undefined,
      suspensionByConsumer: undefined,
      upgrade: undefined,
      archiving: undefined,
    };

    const agreement = {
      ...getMockAgreement(),
      verifiedAttributes: [verifiedAttribute],
      certifiedAttributes: [certifiedAttribute],
      declaredAttributes: [declareddAttribute],
      suspendedByConsumer: undefined,
      suspendedByProducer: undefined,
      suspendedByPlatform: undefined,
      consumerDocuments: [consumerDocument],
      updatedAt: undefined,
      consumerNotes: undefined,
      contract: undefined,
      stamps: agreemenStamps,
      rejectionReason: undefined,
      suspendedAt: undefined,
    };
    // convert an agreement into a specific agreement data model
    const {
      agreementSQL,
      agreementDocumentsSQL,
      agreementAttributesSQL,
      agreementStampsSQL,
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

    const expectedAgreementDocumentSQL: AgreementDocumentSQL = {
      ...consumerDocument,
      agreementId: agreement.id,
      metadataVersion: 1,
      kind: agreementDocumentKind.consumerDoc,
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
      attributeId: declareddAttribute.id,
    };

    const agreemenStampSQL: AgreementStampSQL = {
      metadataVersion: 1,
      agreementId: agreement.id,
      kind: agreementStampKind.submission,
      who: agreementSubmissionStamp.who,
      when: agreementSubmissionStamp.when.toISOString(),
      delegationId: null,
    };
    const expectedAgreementStampsSQL: AgreementStampSQL[] = [agreemenStampSQL];

    expect(agreementSQL).toEqual(expectedAgreementSQL);
    expect(agreementDocumentsSQL).toEqual(
      expect.arrayContaining([expectedAgreementDocumentSQL])
    );
    expect(agreementAttributesSQL).toEqual(
      expect.arrayContaining([
        expectedAgreementVerifiedAttributeSQL,
        expectedAgreementCertifiedAttributeSQL,
        expectedAgreementDeclaredAttributeSQL,
      ])
    );
    expect(agreementStampsSQL).toEqual(expectedAgreementStampsSQL);
  });
});
