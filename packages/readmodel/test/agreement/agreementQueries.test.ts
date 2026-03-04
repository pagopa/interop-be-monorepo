import { describe, expect, it } from "vitest";
import { Agreement, WithMetadata } from "pagopa-interop-models";
import { getMockAgreement } from "pagopa-interop-commons-test";
import { upsertAgreement } from "../../src/testUtils.js";
import { readModelDB } from "../utils.js";
import { agreementReadModelService } from "./agreementUtils.js";

describe("Agreement queries", () => {
  describe("getAgreementById", () => {
    it("agreement found", async () => {
      const agreement: WithMetadata<Agreement> = {
        data: getMockAgreement(),
        metadata: { version: 1 },
      };

      await upsertAgreement(
        readModelDB,
        agreement.data,
        agreement.metadata.version
      );
      await upsertAgreement(
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

      await upsertAgreement(readModelDB, getMockAgreement(), 1);

      const retrievedAgreement =
        await agreementReadModelService.getAgreementById(agreement.data.id);

      expect(retrievedAgreement).toBeUndefined();
    });
  });
});
