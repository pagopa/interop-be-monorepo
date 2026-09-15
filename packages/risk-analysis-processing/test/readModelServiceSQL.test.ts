import { eq } from "drizzle-orm";
import { getMockPurpose } from "pagopa-interop-commons-test";
import { Purpose } from "pagopa-interop-models";
import { purposeInReadmodelPurpose } from "pagopa-interop-readmodel-models";
import { describe, expect, it } from "vitest";

import { addOnePurpose, readModelDB, readModelService } from "./utils.js";

describe("purposes", () => {
  it("gets purpose ids with a legacy review mode", async () => {
    const legacyPurpose: Purpose = {
      ...getMockPurpose(),
      reviewMode: "AdminWritesReviewerSigns",
    };
    await addOnePurpose(legacyPurpose);
    await readModelDB
      .update(purposeInReadmodelPurpose)
      .set({
        reviewerWorkflowReviewMode: "AdminWritesReviewerSigns",
        reviewMode: null,
      })
      .where(eq(purposeInReadmodelPurpose.id, legacyPurpose.id));

    const migratedPurpose: Purpose = {
      ...getMockPurpose(),
      reviewMode: "AdminWritesReviewerSigns",
    };
    await addOnePurpose(migratedPurpose);

    const purposeIds =
      await readModelService.getAllReadModelPurposeIdsWithLegacyReviewMode();

    expect(purposeIds).toEqual([legacyPurpose.id]);
  });
});
