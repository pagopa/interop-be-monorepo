import { getMockTenant } from "pagopa-interop-commons-test";
import {
  generateId,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  Tenant,
} from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import type { Institution } from "../src/services/openDataExtractor.js";

import {
  buildTenantsIndex,
  getTenantParentUpdates,
} from "../src/services/ipaCertifiedAttributesImporterService.js";

const origin = PUBLIC_ADMINISTRATIONS_IDENTIFIER;

const tenantOf = (value: string): Tenant => ({
  ...getMockTenant(),
  id: generateId(),
  externalId: { origin, value },
});

const institution = (
  classification: Institution["classification"],
  originId: string,
  rest: Partial<Institution> = {}
): Institution => ({
  id: `tax-${originId}`,
  originId,
  category: "c",
  description: "d",
  origin,
  kind: "k",
  classification,
  ...rest,
});

const root = tenantOf("ROOT");
const aooTenant = tenantOf("AOO1");
const uoTenant = tenantOf("UO1");
const uoNoAooTenant = tenantOf("UO2");

const aooInst = institution("AOO", "AOO1", {
  rootOriginId: "ROOT",
  parentOriginId: "ROOT",
});
const uoInst = institution("UO", "UO1", {
  rootOriginId: "ROOT",
  aooOriginId: "AOO1",
  parentOriginId: "AOO1",
});
const uoNoAooInst = institution("UO", "UO2", {
  rootOriginId: "ROOT",
  parentOriginId: "ROOT",
});

describe("getTenantParentUpdates", () => {
  const tenants = buildTenantsIndex([root, aooTenant, uoTenant, uoNoAooTenant]);

  it("computes parent and root ids, AOO before UO, skipping agencies", () => {
    const updates = getTenantParentUpdates(
      {
        institutions: [
          institution("Agency", "ROOT"),
          aooInst,
          uoInst,
          uoNoAooInst,
        ],
        attributes: [],
      },
      tenants
    );

    expect(updates).toEqual([
      { tenant: aooTenant, parentTenantId: root.id, rootTenantId: root.id },
      { tenant: uoTenant, parentTenantId: aooTenant.id, rootTenantId: root.id },
      {
        tenant: uoNoAooTenant,
        parentTenantId: root.id,
        rootTenantId: root.id,
      },
    ]);
  });

  it("resets both ids when the parent is missing", () => {
    const updates = getTenantParentUpdates(
      { institutions: [uoInst], attributes: [] },
      buildTenantsIndex([root, uoTenant])
    );
    expect(updates).toEqual([
      { tenant: uoTenant, parentTenantId: null, rootTenantId: null },
    ]);
  });

  it("resets both ids when the root is missing", () => {
    const updates = getTenantParentUpdates(
      { institutions: [uoInst], attributes: [] },
      buildTenantsIndex([aooTenant, uoTenant])
    );
    expect(updates).toEqual([
      { tenant: uoTenant, parentTenantId: null, rootTenantId: null },
    ]);
  });

  it("excludes AOO/UO not onboarded", () => {
    expect(
      getTenantParentUpdates(
        { institutions: [aooInst, uoInst], attributes: [] },
        buildTenantsIndex([root])
      )
    ).toEqual([]);
  });
});
