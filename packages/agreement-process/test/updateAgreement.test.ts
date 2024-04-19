/* eslint-disable functional/no-let */
import {
  getMockAgreement,
  getRandomAuthData,
  decodeProtobufPayload,
  randomArrayItem,
} from "pagopa-interop-commons-test";
import {
  AgreementId,
  AgreementUpdatedV1,
  agreementState,
  generateId,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { toAgreementV1 } from "../src/model/domain/toEvent.js";
import {
  agreementNotFound,
  agreementNotInExpectedState,
  operationNotAllowed,
} from "../src/model/domain/errors.js";
import { agreementUpdatableStates } from "../src/model/domain/validators.js";
import { addOneAgreement, readLastAgreementEvent } from "./utils.js";
import { agreementService, agreements, postgresDB } from "./vitestSetup.js";

describe("update agreement", () => {
  it("should succeed when requester is Consumer and the Agreement is in an updatable state", async () => {
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(agreementUpdatableStates),
    };
    await addOneAgreement(agreement, postgresDB, agreements);
    const authData = getRandomAuthData(agreement.consumerId);
    await agreementService.updateAgreement(
      agreement.id,
      { consumerNotes: "Updated consumer notes" },
      authData,
      uuidv4()
    );

    const agreementEvent = await readLastAgreementEvent(
      agreement.id,
      postgresDB
    );

    expect(agreementEvent).toMatchObject({
      type: "AgreementUpdated",
      event_version: 1,
      version: "1",
      stream_id: agreement.id,
    });

    const actualAgreementUptaded = decodeProtobufPayload({
      messageType: AgreementUpdatedV1,
      payload: agreementEvent.data,
    }).agreement;

    expect(actualAgreementUptaded).toMatchObject({
      ...toAgreementV1(agreement),
      consumerNotes: "Updated consumer notes",
    });
  });

  it("should throw an agreementNotFound error when the agreement does not exist", async () => {
    await addOneAgreement(getMockAgreement(), postgresDB, agreements);
    const authData = getRandomAuthData();
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
    const authData = getRandomAuthData();
    const agreement = getMockAgreement();
    await addOneAgreement(agreement, postgresDB, agreements);
    await expect(
      agreementService.updateAgreement(
        agreement.id,
        { consumerNotes: "Updated consumer notes" },
        authData,
        uuidv4()
      )
    ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should throw agreementNotInExpectedState when the agreement is not in an updatable state", async () => {
    const agreement = {
      ...getMockAgreement(),
      state: randomArrayItem(
        Object.values(agreementState).filter(
          (s) => !agreementUpdatableStates.includes(s)
        )
      ),
    };
    await addOneAgreement(agreement, postgresDB, agreements);
    const authData = getRandomAuthData(agreement.consumerId);
    await expect(
      agreementService.updateAgreement(
        agreement.id,
        { consumerNotes: "Updated consumer notes" },
        authData,
        uuidv4()
      )
    ).rejects.toThrowError(
      agreementNotInExpectedState(agreement.id, agreement.state)
    );
  });
});
