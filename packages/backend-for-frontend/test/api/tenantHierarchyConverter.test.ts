import { bffApi, tenantApi } from "pagopa-interop-api-clients";
import { getMockTenant } from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { toBffApiTenant } from "../../src/api/tenantApiConverter.js";

describe("tenant hierarchy conversion", () => {
  it.each([
    { subUnitType: undefined, parentTenant: undefined },
    {
      subUnitType: "AOO" as const,
      parentTenant: { id: generateId(), name: "Root" },
    },
    {
      subUnitType: "UO" as const,
      parentTenant: { id: generateId(), name: "Root" },
    },
    {
      subUnitType: "UO" as const,
      parentTenant: {
        id: generateId(),
        name: "Area",
        subUnitType: "AOO" as const,
        parentTenant: { id: generateId(), name: "Root" },
      },
    },
    { subUnitType: "UO" as const, parentTenant: undefined },
    {
      subUnitType: undefined,
      parentTenant: { id: generateId(), name: "Root" },
    },
    {
      subUnitType: "UO" as const,
      parentTenant: {
        id: generateId(),
        name: "Parent",
        parentTenant: {
          id: generateId(),
          name: "Ancestor",
          parentTenant: { id: generateId(), name: "Root" },
        },
      },
    },
  ])(
    "preserves independent type and optional ancestry: %j",
    ({ subUnitType, parentTenant }) => {
      const mock = getMockTenant();
      const input: tenantApi.Tenant = {
        id: mock.id,
        name: mock.name,
        externalId: mock.externalId,
        createdAt: mock.createdAt.toISOString(),
        attributes: [],
        features: [],
        mails: [],
        subUnitType,
        parentTenant,
      };
      const output = bffApi.Tenant.parse(
        toBffApiTenant(input, [], [], [], new Map())
      );
      expect(output.name).toBe(input.name);
      expect(output.subUnitType).toBe(subUnitType);
      expect(output.parentTenant).toEqual(parentTenant);
    }
  );
});
