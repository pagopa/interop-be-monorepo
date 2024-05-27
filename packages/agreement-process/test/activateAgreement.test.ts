import { describe, expect, it } from "vitest";
import {
  getMockAgreement,
  getMockEService,
  getRandomAuthData,
} from "pagopa-interop-commons-test";
import { genericLogger } from "pagopa-interop-commons";
import { generateId, AgreementId, agreementState } from "pagopa-interop-models";
import {
  agreementNotFound,
  operationNotAllowed,
} from "../src/model/domain/errors.js";
import { addOneAgreement, agreementService } from "./utils.js";

describe("activate agreement", () => {
  // TODO success case (include the edge case of the producer being able to activate the agreement if the state is pending)

  it("should throw an agreementNotFound error when the Agreement does not exist", async () => {
    await addOneAgreement(getMockAgreement());
    const authData = getRandomAuthData();
    const agreementId = generateId<AgreementId>();
    await expect(
      agreementService.activateAgreement(agreementId, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });

  it("should throw an operationNotAllowed error when the requester is not the Consumer or Producer", async () => {
    const authData = getRandomAuthData();
    const agreement = getMockAgreement();
    await addOneAgreement(agreement);
    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should throw an operationNotAllowed error when the requester is the Consumer and the Agreement is Pending", async () => {
    const authData = getRandomAuthData();

    const agreement = {
      ...getMockAgreement(),
      state: agreementState.pending,
      consumerId: authData.organizationId,
    };
    await addOneAgreement(agreement);
    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.toThrowError(operationNotAllowed(authData.organizationId));
  });

  it("should NOT throw an operationNotAllowed error when the requester is the Producer and the Agreement is Pending", async () => {
    const authData = getRandomAuthData();

    const eservice = {
      ...getMockEService(),
      producerId: authData.organizationId,
    };
    const agreement = {
      ...getMockAgreement(),
      state: agreementState.pending,
      producerId: eservice.producerId,
    };
    await addOneAgreement(agreement);
    await expect(
      agreementService.activateAgreement(agreement.id, {
        authData,
        serviceName: "",
        correlationId: "",
        logger: genericLogger,
      })
    ).rejects.not.toThrowError(operationNotAllowed(authData.organizationId));
  });
});
