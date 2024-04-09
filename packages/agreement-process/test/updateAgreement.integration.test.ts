/* eslint-disable functional/no-let */
import {
  getMockAgreement,
  getRandomAuthData,
  decodeProtobufPayload,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementUpdatedV1,
  agreementState,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { toAgreementV1 } from "../src/model/domain/toEvent.js";
import { addOneAgreement, readLastAgreementEvent } from "./utils.js";
import {
  postgresDB,
  agreements,
  agreementService,
} from "./agreementService.test.setup.js";

describe("Agreement service", () => {
  describe("update agreement", () => {
    let agreement1: Agreement;

    beforeEach(async () => {
      agreement1 = {
        ...getMockAgreement(),
        state: agreementState.draft,
      };

      await addOneAgreement(agreement1, postgresDB, agreements);
      await addOneAgreement(getMockAgreement(), postgresDB, agreements);
    });

    it("should succeed when requester is Consumer the Agreement is in an updatable state", async () => {
      const authData = getRandomAuthData(agreement1.consumerId);
      await agreementService.updateAgreement(
        agreement1.id,
        { consumerNotes: "Updated consumer notes" },
        authData,
        uuidv4()
      );

      const agreementEvent = await readLastAgreementEvent(
        agreement1.id,
        postgresDB
      );

      expect(agreementEvent).toMatchObject({
        type: "AgreementUpdated",
        event_version: 1,
        version: "0",
        stream_id: agreement1.id,
      });

      const actualAgreementUptaded = decodeProtobufPayload({
        messageType: AgreementUpdatedV1,
        payload: agreementEvent.data,
      }).agreement;

      expect(actualAgreementUptaded).toMatchObject({
        ...toAgreementV1(agreement1),
        consumerNotes: "Updated consumer notes",
      });
    });
  });
});
