import { describe, expect, it } from "vitest";
import { Agreement, WithMetadata } from "pagopa-interop-models";
import {
  addOneAgreementSQL,
  getMockAgreement,
} from "pagopa-interop-commons-test";
import { agreementReadModelService } from "./agreementUtils.js";
import { readModelDB } from "./utils.js";

describe("Agreement queries", () => {
  describe("getAgreementById", () => {
    it("agreement found", async () => {
      const agreement: WithMetadata<Agreement> = {
        data: getMockAgreement(),
        metadata: { version: 1 },
      };

      await addOneAgreementSQL(
        readModelDB,
        agreement.data,
        agreement.metadata.version
      );
      await addOneAgreementSQL(
        readModelDB,
        getMockAgreement(),
        agreement.metadata.version
      );

      const retrievedAgreement =
        await agreementReadModelService.getAgreementById(agreement.data.id);

      expect(retrievedAgreement).toStrictEqual(agreement);
    });

    it("agreement NOT found", async () => {
      const agreement: WithMetadata<Agreement> = {
        data: getMockAgreement(),
        metadata: { version: 1 },
      };

      await addOneAgreementSQL(readModelDB, getMockAgreement(), 1);

      const retrievedAgreement =
        await agreementReadModelService.getAgreementById(agreement.data.id);

      expect(retrievedAgreement).toBeUndefined();
    });
  });
});
