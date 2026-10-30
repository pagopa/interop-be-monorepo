import {
  getMockPurposeTemplate,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { purposeTemplateState } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import {
  addOnePurposeTemplate,
  addOneTenant,
  readModelService,
} from "../integrationUtils.js";

describe("purpose template creator hierarchy filters", () => {
  it.each([
    "Hierarchy unit",
    "Hierarchy area",
    "Hierarchy institution",
    "absent",
  ])("matches %s only for published creators", async (creatorName) => {
    const root = { ...getMockTenant(), name: "Hierarchy institution" };
    const parent = { ...getMockTenant(), name: "Hierarchy area" };
    await addOneTenant(root);
    await addOneTenant(parent);
    const publishedCreator = {
      ...getMockTenant(),
      name: "Hierarchy unit",
      parentTenantId: parent.id,
      rootTenantId: root.id,
    };
    for (const state of Object.values(purposeTemplateState)) {
      const creator =
        state === purposeTemplateState.published
          ? publishedCreator
          : { ...publishedCreator, id: getMockTenant().id };
      await addOneTenant(creator);
      await addOnePurposeTemplate({
        ...getMockPurposeTemplate(),
        creatorId: creator.id,
        state,
      });
    }
    const unrelated = getMockTenant();
    await addOneTenant(unrelated);
    await addOnePurposeTemplate({
      ...getMockPurposeTemplate(),
      creatorId: unrelated.id,
      state: purposeTemplateState.published,
    });
    const result = await readModelService.getPublishedPurposeTemplateCreators({
      creatorName,
      limit: 50,
      offset: 0,
    });
    expect(result.results.map((t) => t.id)).toEqual(
      creatorName === "absent" ? [] : [publishedCreator.id]
    );
    expect(result.totalCount).toBe(creatorName === "absent" ? 0 : 1);
  });
});
