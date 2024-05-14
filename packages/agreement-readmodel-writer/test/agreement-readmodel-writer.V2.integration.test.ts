/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  AgreementCollection,
  ReadModelRepository,
  readModelWriterConfig,
} from "pagopa-interop-commons";
import {
  getMockAgreement,
  mongoDBContainer,
} from "pagopa-interop-commons-test";
import {
  AgreementEventEnvelopeV2,
  AgreementStateV2,
  generateId,
} from "pagopa-interop-models";
import { StartedTestContainer } from "testcontainers";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { handleMessageV2 } from "../src/consumerServiceV2.js";

describe("events V2", async () => {
  let agreements: AgreementCollection;
  let startedMongoDBContainer: StartedTestContainer;

  const config = readModelWriterConfig();
  beforeAll(async () => {
    startedMongoDBContainer = await mongoDBContainer(config).start();

    config.readModelDbPort = startedMongoDBContainer.getMappedPort(27017);

    const readModelRepository = ReadModelRepository.init(config);
    agreements = readModelRepository.agreements;
  });

  afterEach(async () => {
    await agreements.deleteMany({});
  });

  afterAll(async () => {
    await startedMongoDBContainer.stop();
  });

  it("should test upsert agreement events", async () => {
    const spyUpdate = vi.spyOn(agreements, "updateOne");
    const spyDelete = vi.spyOn(agreements, "deleteOne");

    const agreement = getMockAgreement();

    const eventTypes = [
      "AgreementAdded",
      "DraftAgreementUpdated",
      "AgreementSubmitted",
      "AgreementActivated",
      "AgreementUpgraded",
      "AgreementUnsuspendedByProducer",
      "AgreementUnsuspendedByConsumer",
      "AgreementUnsuspendedByPlatform",
      "AgreementArchivedByUpgrade",
      "AgreementArchivedByConsumer",
      "AgreementSuspendedByProducer",
      "AgreementSuspendedByConsumer",
      "AgreementSuspendedByPlatform",
      "AgreementRejected",
      "AgreementArchivedByUpgrade",
      "AgreementUpgraded",
    ] as const;

    for (const eventType of eventTypes) {
      const event = {
        agreement: {
          id: agreement.id,
          eserviceId: agreement.eserviceId,
          descriptorId: agreement.descriptorId,
          producerId: agreement.producerId,
          consumerId: agreement.consumerId,
          state: AgreementStateV2.ACTIVE,
          certifiedAttributes: [],
          declaredAttributes: [],
          verifiedAttributes: [],
          createdAt: BigInt(new Date().getTime()),
          consumerDocuments: [],
        },
      };

      const message: AgreementEventEnvelopeV2 = {
        event_version: 2,
        sequence_num: 1,
        stream_id: agreement.id,
        version: 1,
        type: eventType,
        data: event,
        log_date: new Date(),
      };

      await handleMessageV2(message, agreements);

      const actualAgreement = await agreements.findOne({
        "data.id": agreement.id.toString(),
      });

      expect(actualAgreement?.data).toMatchObject({
        id: agreement.id,
        eserviceId: agreement.eserviceId,
        descriptorId: agreement.descriptorId,
        producerId: agreement.producerId,
        consumerId: agreement.consumerId,
        state: "Active",
        certifiedAttributes: [],
        declaredAttributes: [],
        verifiedAttributes: [],
        consumerDocuments: [],
      });

      expect(spyUpdate).toHaveBeenCalled();
      expect(spyDelete).not.toHaveBeenCalled();
    }
  });

  it("should test all agreement consumer document events", async () => {
    const spyUpdate = vi.spyOn(agreements, "updateOne");
    const spyDelete = vi.spyOn(agreements, "deleteOne");

    const agreement = getMockAgreement();

    const eventTypesConsumerDocument = [
      "AgreementConsumerDocumentAdded",
      "AgreementConsumerDocumentRemoved",
    ] as const;

    for (const eventType of eventTypesConsumerDocument) {
      const event = {
        agreement: {
          id: agreement.id,
          eserviceId: agreement.eserviceId,
          descriptorId: agreement.descriptorId,
          producerId: agreement.producerId,
          consumerId: agreement.consumerId,
          state: AgreementStateV2.ACTIVE,
          certifiedAttributes: [],
          declaredAttributes: [],
          verifiedAttributes: [],
          createdAt: BigInt(new Date().getTime()),
          consumerDocuments: [],
        },
        documentId: generateId(),
      };

      const message: AgreementEventEnvelopeV2 = {
        event_version: 2,
        sequence_num: 1,
        stream_id: agreement.id,
        version: 1,
        type: eventType,
        data: event,
        log_date: new Date(),
      };

      await handleMessageV2(message, agreements);

      const actualAgreement = await agreements.findOne({
        "data.id": agreement.id.toString(),
      });

      expect(actualAgreement?.data).toMatchObject({
        id: agreement.id,
        eserviceId: agreement.eserviceId,
        descriptorId: agreement.descriptorId,
        producerId: agreement.producerId,
        consumerId: agreement.consumerId,
        state: "Active",
        certifiedAttributes: [],
        declaredAttributes: [],
        verifiedAttributes: [],
        consumerDocuments: [],
      });

      expect(spyUpdate).toHaveBeenCalled();
      expect(spyDelete).not.toHaveBeenCalled();
    }
  });

  it("should test delete agreement", async () => {
    const spyUpdate = vi.spyOn(agreements, "updateOne");
    const spyDelete = vi.spyOn(agreements, "deleteOne");

    const agreement = getMockAgreement();

    const eventType = "AgreementDeleted";
    const event = {
      agreement: {
        id: agreement.id,
        eserviceId: agreement.eserviceId,
        descriptorId: agreement.descriptorId,
        producerId: agreement.producerId,
        consumerId: agreement.consumerId,
        state: AgreementStateV2.ACTIVE,
        certifiedAttributes: [],
        declaredAttributes: [],
        verifiedAttributes: [],
        createdAt: BigInt(new Date().getTime()),
        consumerDocuments: [],
      },
      documentId: generateId(),
    };

    const message: AgreementEventEnvelopeV2 = {
      event_version: 2,
      sequence_num: 1,
      stream_id: agreement.id,
      version: 1,
      type: eventType,
      data: event,
      log_date: new Date(),
    };

    await handleMessageV2(message, agreements);

    const actualAgreement = await agreements.findOne({
      "data.id": agreement.id.toString(),
    });

    expect(actualAgreement).toBeNull();

    expect(spyUpdate).not.toHaveBeenCalled();
    expect(spyDelete).toHaveBeenCalled();
  });
});
