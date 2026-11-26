import { bffApi, eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  getMockedApiEserviceTemplateVersion,
  getMockedApiEServiceTemplate,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
import { generateId, TenantId, tenantUnitType } from "pagopa-interop-models";
import { describe, expect, it } from "vitest";

import { toBffCatalogEServiceTemplate } from "../src/api/eserviceTemplateApiConverter.js";

describe("eserviceTemplateApiConverter", () => {
  describe("toBffCatalogEServiceTemplate", () => {
    it("should use the template description as catalog description", () => {
      const eserviceTemplate = getMockedApiEServiceTemplate({
        versions: [
          getMockedApiEserviceTemplateVersion({
            state:
              eserviceTemplateApi.EServiceTemplateVersionState.Values.PUBLISHED,
          }),
        ],
      });
      const templateWithDistinctDescriptions = {
        ...eserviceTemplate,
        intendedTarget: "template intended target",
        description: "template description",
      };
      const creator = getMockedApiTenant();

      const result = toBffCatalogEServiceTemplate(
        templateWithDistinctDescriptions,
        creator
      );

      expect(result.description).toBe(
        templateWithDistinctDescriptions.description
      );
    });

    it("should return the creator parent and root tenants when available", () => {
      const parentTenantId = generateId<TenantId>();
      const rootTenantId = generateId<TenantId>();
      const template = getMockedApiEServiceTemplate({
        versions: [
          getMockedApiEserviceTemplateVersion({
            state:
              eserviceTemplateApi.EServiceTemplateVersionState.Values.PUBLISHED,
          }),
        ],
      });
      const creator = {
        ...getMockedApiTenant(),
        name: "Tenant UO",
        subUnitType: tenantUnitType.UO,
        parentTenants: [
          {
            id: parentTenantId,
            name: "Tenant AOO",
            subUnitType: tenantUnitType.AOO,
          },
          { id: rootTenantId, name: "Tenant root" },
        ],
      };

      const result = toBffCatalogEServiceTemplate(template, creator);

      expect(
        bffApi.CatalogEServiceTemplate.parse(result).creator
      ).toMatchObject({
        id: creator.id,
        name: creator.name,
        subUnitType: tenantUnitType.UO,
        parentTenants: [
          {
            id: parentTenantId,
            name: "Tenant AOO",
            subUnitType: tenantUnitType.AOO,
          },
          { id: rootTenantId, name: "Tenant root" },
        ],
      });
    });
  });
});
