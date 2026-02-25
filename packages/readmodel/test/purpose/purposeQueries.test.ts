import { describe, it, expect } from "vitest";
import { generateId } from "pagopa-interop-models";
import {
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import { upsertPurpose } from "../../src/testUtils.js";
import { readModelDB } from "../utils.js";
import { purposeReadModelService } from "./purposeUtils.js";

describe("Purpose queries", () => {
  describe("Get a Purpose", async () => {
    it("should get a purpose by id if present", async () => {
      const purpose = getMockPurpose([getMockPurposeVersion()]);
      await upsertPurpose(readModelDB, purpose, 1);

      const retrievedPurpose = await purposeReadModelService.getPurposeById(
        purpose.id
      );

      expect(retrievedPurpose).toStrictEqual({
        data: purpose,
        metadata: { version: 1 },
      });
    });

    it("should *not* get a purpose by id if not present", async () => {
      const retrievedPurpose =
        await purposeReadModelService.getPurposeById(generateId());

      expect(retrievedPurpose).toBeUndefined();
    });
  });
});
