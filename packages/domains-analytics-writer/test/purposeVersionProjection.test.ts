import {
  getMockPurpose,
  getMockPurposeVersion,
} from "pagopa-interop-commons-test";
import { PurposeVersionSchema } from "pagopa-interop-kpi-models";
import {
  purposeVersionState,
  purposeWaitingForApprovalReason,
} from "pagopa-interop-models";
import { splitPurposeIntoObjectsSQL } from "pagopa-interop-readmodel";
import { describe, expect, it } from "vitest";

import { PurposeDbTable } from "../src/model/db/purpose.js";
import { generateMergeQuery } from "../src/utils/sqlQueryHelper.js";

describe("purpose version analytics projection", () => {
  it.each([undefined, ...Object.values(purposeWaitingForApprovalReason)])(
    "excludes operational quota reason %s from analytics records and merge SQL",
    (waitingForApprovalReason) => {
      const version = {
        ...getMockPurposeVersion(purposeVersionState.waitingForApproval),
        waitingForApprovalReason,
      };
      const purpose = getMockPurpose([version]);
      const { versionsSQL } = splitPurposeIntoObjectsSQL(purpose, 1);
      expect(versionsSQL[0].waitingForApprovalReason).toBe(
        waitingForApprovalReason ?? null
      );
      const analyticsVersion = PurposeVersionSchema.parse(versionsSQL[0]);
      expect(analyticsVersion).not.toHaveProperty("waitingForApprovalReason");
      expect(analyticsVersion).toMatchObject({
        id: version.id,
        purposeId: purpose.id,
        state: version.state,
        dailyCalls: version.dailyCalls,
      });
      const merge = generateMergeQuery(
        PurposeVersionSchema,
        "domains",
        PurposeDbTable.purpose_version,
        ["id"]
      );
      expect(merge).not.toContain("waiting_for_approval_reason");
      expect(merge).toContain('source."daily_calls"');
    }
  );
});
