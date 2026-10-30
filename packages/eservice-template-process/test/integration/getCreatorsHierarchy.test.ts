import {
  getMockContext,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { eserviceTemplateVersionState } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import {
  addOneEServiceTemplate,
  addOneTenant,
  eserviceTemplateService,
} from "../integrationUtils.js";

describe("e-service template creator hierarchy filters", () => {
  it.each([
    "Hierarchy unit",
    "Hierarchy area",
    "Hierarchy institution",
    "absent",
  ])("matches %s only for published creators", async (name) => {
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
    for (const state of Object.values(eserviceTemplateVersionState)) {
      const creator =
        state === eserviceTemplateVersionState.published
          ? publishedCreator
          : { ...publishedCreator, id: getMockTenant().id };
      await addOneTenant(creator);
      await addOneEServiceTemplate({
        ...getMockEServiceTemplate(),
        creatorId: creator.id,
        versions: [{ ...getMockEServiceTemplateVersion(), state }],
      });
    }
    const unrelated = getMockTenant();
    await addOneTenant(unrelated);
    await addOneEServiceTemplate({
      ...getMockEServiceTemplate(),
      creatorId: unrelated.id,
      versions: [
        {
          ...getMockEServiceTemplateVersion(),
          state: eserviceTemplateVersionState.published,
        },
      ],
    });
    const result = await eserviceTemplateService.getEServiceTemplateCreators(
      name,
      50,
      0,
      getMockContext({})
    );
    expect(result.results.map((t) => t.id)).toEqual(
      name === "absent" ? [] : [publishedCreator.id]
    );
    expect(result.totalCount).toBe(name === "absent" ? 0 : 1);
  });
});
