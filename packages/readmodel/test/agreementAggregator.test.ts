import {
  Agreement,
  AgreementId,
  AgreementStamps,
  agreementState,
  DelegationId,
  DescriptorId,
  EServiceId,
  generateId,
  TenantId,
  WithMetadata,
} from "pagopa-interop-models";
import {
  getMockAgreement,
  getMockAgreementAttribute,
  getMockAgreementContract,
  getMockAgreementDocument,
  getMockAgreementStamps,
} from "pagopa-interop-commons-test";
import { describe, it, expect } from "vitest";
import { splitAgreementIntoObjectsSQL } from "../src/agreement/splitters.js";
import { aggregateAgreement } from "../src/agreement/aggregators.js";

describe("Agreement Aggregator", () => {
  it("should convert an Agreement object as data model into an Agreement object as business model", () => {
    const eserviceId = generateId<EServiceId>();
    const mockAgreementStamps = getMockAgreementStamps();
    const agreementStamps: AgreementStamps = {};
    const delegationId = generateId<DelegationId>();
    const signedContract = generateId();

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
    const agreement: WithMetadata<Agreement> = {
      data: {
        ...getMockAgreement(),
        eserviceId,
        verifiedAttributes: [getMockAgreementAttribute()],
        certifiedAttributes: [getMockAgreementAttribute()],
        declaredAttributes: [getMockAgreementAttribute()],
        suspendedByConsumer: true,
        suspendedByProducer: false,
        suspendedByPlatform: true,
        consumerDocuments: [getMockAgreementDocument()],
        updatedAt: new Date(),
        consumerNotes: "some notes",
        contract: {
          ...getMockAgreementContract(),
          createdAt: new Date(),
          signedAt: new Date(),
        },
        stamps: agreementStamps,
        rejectionReason: "some rejection reason",
        suspendedAt: new Date(),
        signedContract,
      },
      metadata: {
        version: 1,
      },
    };
    const {
      agreementSQL,
      consumerDocumentsSQL,
      contractSQL,
      attributesSQL,
      stampsSQL,
    } = splitAgreementIntoObjectsSQL(
      agreement.data,
      agreement.metadata.version,
    );

    const aggregatedAgreement = aggregateAgreement({
      agreementSQL,
      stampsSQL,
      consumerDocumentsSQL,
      contractSQL,
      attributesSQL,
    });

    expect(aggregatedAgreement).toStrictEqual(agreement);
  });

  it("should convert a Agreement object with null values as data model into an Agreement object with undefined values as business model", () => {
    const mockAgreementStamps = getMockAgreementStamps();
    const agreementStamps: AgreementStamps = {};

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
        };
      }
    }
    const agreement: WithMetadata<Agreement> = {
      data: {
        id: generateId<AgreementId>(),
        eserviceId: generateId<EServiceId>(),
        descriptorId: generateId<DescriptorId>(),
        producerId: generateId<TenantId>(),
        consumerId: generateId<TenantId>(),
        state: agreementState.draft,
        createdAt: new Date(),
        verifiedAttributes: [getMockAgreementAttribute()],
        certifiedAttributes: [getMockAgreementAttribute()],
        declaredAttributes: [getMockAgreementAttribute()],
        consumerDocuments: [getMockAgreementDocument()],
        stamps: agreementStamps,
        signedContract: generateId(),
      },
      metadata: {
        version: 1,
      },
    };
    const {
      agreementSQL,
      consumerDocumentsSQL,
      contractSQL,
      attributesSQL,
      stampsSQL,
    } = splitAgreementIntoObjectsSQL(
      agreement.data,
      agreement.metadata.version,
    );

    const aggregatedAgreement = aggregateAgreement({
      agreementSQL,
      stampsSQL,
      consumerDocumentsSQL,
      contractSQL,
      attributesSQL,
    });

    expect(aggregatedAgreement).toStrictEqual(agreement);
  });
});
