import { getMockAgreement, sortAgreement } from "pagopa-interop-commons-test";
import {
  AgreementEventEnvelopeV2,
  generateId,
  toAgreementV2,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleMessageV2 } from "../src/consumerServiceV2.js";
import { agreementReadModelService, agreementWriterService } from "./utils.js";

describe("events V2", async () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  it("should test upsert agreement events", async () => {
    const spyUpdate = vi.spyOn(agreementWriterService, "upsertAgreement");

    const agreement = getMockAgreement();
    await agreementWriterService.upsertAgreement(agreement, 1);

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
        version: 2,
        type: eventType,
        data: event,
        log_date: new Date(),
      };

      await handleMessageV2(message, agreementWriterService);

      const actualAgreement = await agreementReadModelService.getAgreementById(
        agreement.id
      );

      expect(sortAgreement(actualAgreement?.data)).toStrictEqual(
        sortAgreement(agreement)
      );

      expect(spyUpdate).toHaveBeenCalled();
    }
  });

  it("should test all agreement consumer document events", async () => {
    const spyUpdate = vi.spyOn(agreementWriterService, "upsertAgreement");
    const spyDelete = vi.spyOn(agreementWriterService, "deleteAgreementById");

    const agreement = getMockAgreement();
    await agreementWriterService.upsertAgreement(agreement, 1);

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

      await handleMessageV2(message, agreementWriterService);

      const actualAgreement = await agreementReadModelService.getAgreementById(
        agreement.id
      );

      expect(sortAgreement(actualAgreement?.data)).toStrictEqual(
        sortAgreement(agreement)
      );

      expect(spyUpdate).toHaveBeenCalled();
      expect(spyDelete).not.toHaveBeenCalled();
    }
  });

  it("should test delete agreement", async () => {
    const spyDelete = vi.spyOn(agreementWriterService, "deleteAgreementById");

    const agreement = getMockAgreement();
    await agreementWriterService.upsertAgreement(agreement, 1);

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

    await handleMessageV2(message, agreementWriterService);

    const actualAgreement = await agreementReadModelService.getAgreementById(
      agreement.id
    );

    expect(actualAgreement).toBeUndefined();

    expect(spyDelete).toHaveBeenCalled();
  });
});
