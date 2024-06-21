import { genericLogger } from "pagopa-interop-commons";
import { getMockAgreement } from "pagopa-interop-commons-test/index.js";
import { Agreement, generateId, AgreementId } from "pagopa-interop-models";
import { describe, it, expect } from "vitest";
import { agreementNotFound } from "../src/model/domain/errors.js";
import { addOneAgreement, agreementService } from "./utils.js";

describe("get agreement", () => {
  it("should get an agreement", async () => {
    const agreement: Agreement = getMockAgreement();
    await addOneAgreement(agreement);
    await addOneAgreement(getMockAgreement());

    const result = await agreementService.getAgreementById(
      agreement.id,
      genericLogger
    );
    expect(result).toEqual(agreement);
  });

  it("should throw an agreementNotFound error when the agreement does not exist", async () => {
    const agreementId = generateId<AgreementId>();

    await addOneAgreement(getMockAgreement());

    await expect(
      agreementService.getAgreementById(agreementId, genericLogger)
    ).rejects.toThrowError(agreementNotFound(agreementId));
  });
});
