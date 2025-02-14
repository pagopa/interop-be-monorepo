/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  getMockAgreement,
  getMockAgreementAttribute,
  getMockAgreementDocument,
  getMockAgreementStamps,
} from "pagopa-interop-commons-test/index.js";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { AgreementSQL } from "../src/types.js";
import { splitAgreementIntoObjectsSQL } from "./../src/agreement/splitters.js";

describe("Agreement Splitter", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  it("should convert an Agreement into an AgreementSQL", () => {
    // set an Agreement
    const verifiedAttribute = getMockAgreementAttribute();
    const consumerDocument = getMockAgreementDocument();
    const contract = getMockAgreementDocument();
    const stamps = getMockAgreementStamps();
    const agreement = {
      ...getMockAgreement(),
      verifiedAttributes: [verifiedAttribute],
      certifiedAttributes: [],
      declaredAttributes: [],
      suspendedByConsumer: true,
      suspendedByProducer: true,
      suspendedByPlatform: true,
      consumerDocuments: [consumerDocument],
      createdAt: new Date(),
      updatedAt: new Date(),
      consumerNotes: "some notes",
      contract,
      stamps,
      rejectionReason: "some rejection reason",
      suspendedAt: new Date(),
    };
    // convert an agreement into a specific agreement data model
    const { agreementSQL } = splitAgreementIntoObjectsSQL(agreement, 1);

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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      consumerNotes: "some notes",
      rejectionReason: "some rejection reason",
      suspendedAt: new Date().toISOString(),
    };

    expect(agreementSQL).toEqual(expectedAgreementSQL);
  });
});
