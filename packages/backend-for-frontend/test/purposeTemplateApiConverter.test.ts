import { bffApi } from "pagopa-interop-api-clients";
import {
  getMockedApiPurposeTemplate,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { toBffCatalogPurposeTemplate } from "../src/api/purposeTemplateApiConverter.js";

describe("toBffCatalogPurposeTemplate", () => {
  it("should preserve catalog fields without creator hierarchy", () => {
    const template = getMockedApiPurposeTemplate();
    const creator = getMockedApiTenant();

    const result = toBffCatalogPurposeTemplate(template, creator);

    expect(bffApi.CatalogPurposeTemplate.parse(result)).toMatchObject({
      id: template.id,
      purposeTitle: template.purposeTitle,
      purposeDescription: template.purposeDescription,
      targetTenantKind: template.targetTenantKind,
      creator: { id: creator.id, name: creator.name },
    });
    expect(result.creator.parentTenants).toBeUndefined();
  });

  it("should return the creator parent and root tenants when available", () => {
    const template = getMockedApiPurposeTemplate();
    const creator = {
      ...getMockedApiTenant(),
      name: "Tenant UO",
      subUnitType: "UO" as const,
      parentTenants: [
        { id: generateId(), name: "Tenant AOO", subUnitType: "AOO" as const },
        { id: generateId(), name: "Tenant root" },
      ],
    };

    const result = toBffCatalogPurposeTemplate(template, creator);

    expect(bffApi.CatalogPurposeTemplate.parse(result).creator).toMatchObject({
      id: creator.id,
      name: creator.name,
      subUnitType: "UO",
      parentTenants: creator.parentTenants,
    });
  });
});
