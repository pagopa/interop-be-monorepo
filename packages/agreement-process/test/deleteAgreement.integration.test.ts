/* eslint-disable functional/no-let */
import {
  decodeProtobufPayload,
  getMockAgreement,
  getRandomAuthData,
  randomArrayItem,
} from "pagopa-interop-commons-test/index.js";
import { describe, expect, it } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { AgreementDeletedV1 } from "pagopa-interop-models";
import { agreementDeletableStates } from "../src/model/domain/validators.js";
import { toAgreementV1 } from "../src/model/domain/toEvent.js";
import {
  postgresDB,
  agreements,
  agreementService,
} from "./agreementService.test.setup.js";
import { addOneAgreement, readLastAgreementEvent } from "./utils.js";

describe("delete agreement", () => {
  it("should succeed when requester is Consumer and the Agreement is in a deletable state", async () => {
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementDeletableStates),
      consumerDocuments: [], // TODO add documents and test file manager delete
    };
    await addOneAgreement(agreement, postgresDB, agreements);
    const authData = getRandomAuthData(agreement.consumerId);
    await agreementService.deleteAgreementById(
      agreement.id,
      authData,
      uuidv4()
    );

    const agreementEvent = await readLastAgreementEvent(
      agreement.id,
      postgresDB
    );

    expect(agreementEvent).toMatchObject({
      type: "AgreementDeleted",
      event_version: 1,
      version: "0",
      stream_id: agreement.id,
    });

    const agreementDeletedId = decodeProtobufPayload({
      messageType: AgreementDeletedV1,
      payload: agreementEvent.data,
    }).agreementId;

    expect(agreementDeletedId).toEqual(agreement.id);
  });
});
