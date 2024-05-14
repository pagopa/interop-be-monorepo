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
  AgreementDeletedV2,
  AgreementEventEnvelopeV2,
  AgreementStateV2,
  generateId,
  toAgreementV2,
  toReadModelAgreement,
} from "pagopa-interop-models";
import { StartedTestContainer } from "testcontainers";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
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

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
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
      "AgreementArchivedByConsumer",
      "AgreementSuspendedByProducer",
      "AgreementSuspendedByConsumer",
      "AgreementSuspendedByPlatform",
      "AgreementRejected",
      "AgreementArchivedByUpgrade",
    ] as const;

    const event = {
      agreement: toAgreementV2(agreement),
    };

    for (const eventType of eventTypes) {
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

      const expectedAgreement = toReadModelAgreement(agreement);

      expect(actualAgreement?.data).toMatchObject(expectedAgreement);

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
        agreement: toAgreementV2(agreement),
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

      const expectedAgreement = toReadModelAgreement(agreement);

      expect(actualAgreement?.data).toMatchObject(expectedAgreement);

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
      agreement: toAgreementV2(agreement),
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
