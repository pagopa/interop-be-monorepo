/* eslint-disable functional/no-let */
import {
  getMockAgreement,
  getRandomAuthData,
  decodeProtobufPayload,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  AgreementId,
  AgreementUpdatedV1,
  agreementState,
  generateId,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { toAgreementV1 } from "../src/model/domain/toEvent.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  operationNotAllowed,
} from "../src/model/domain/errors.js";
import { agreementUpdatableStates } from "../src/model/domain/validators.js";
import { addOneAgreement, readLastAgreementEvent } from "./utils.js";
import {
  postgresDB,
  agreements,
  agreementService,
} from "./agreementService.test.setup.js";

describe("update agreement", () => {
  let agreement1: Agreement;
  let agreement2: Agreement;

  beforeEach(async () => {
    agreement1 = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementUpdatableStates),
    };

    agreement2 = {
      ...getMockAgreement(),
      state: randomArrayItem(
        Object.values(agreementState).filter(
          (s) => !agreementUpdatableStates.includes(s)
        )
      ),
    };

    await addOneAgreement(agreement1, postgresDB, agreements);
    await addOneAgreement(agreement2, postgresDB, agreements);
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

  it("should throw an agreementNotFound error when the agreement does not exist", async () => {
    const authData = getRandomAuthData(agreement1.consumerId);
    const agreementId = generateId<AgreementId>();
    await expect(
      agreementService.updateAgreement(
        agreementId,
        { consumerNotes: "Updated consumer notes" },
        authData,
        uuidv4()
      )
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });

  it("should throw operationNotAllowed when the requester is not the Consumer", async () => {
    const authData = getRandomAuthData(agreement2.consumerId);
    await expect(
      agreementService.updateAgreement(
        agreement1.id,
        { consumerNotes: "Updated consumer notes" },
        authData,
        uuidv4()
      )
    ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should throw agreementNotInExpectedState when the agreement is not in an updatable state", async () => {
    const authData = getRandomAuthData(agreement2.consumerId);
    await expect(
      agreementService.updateAgreement(
        agreement2.id,
        { consumerNotes: "Updated consumer notes" },
        authData,
        uuidv4()
      )
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement2.id, agreement2.state)
    );
  });
});
