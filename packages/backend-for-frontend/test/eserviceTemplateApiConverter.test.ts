import { describe, expect, it } from "vitest";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  getMockedApiEserviceTemplateVersion,
  getMockedApiEServiceTemplate,
  getMockedApiTenant,
} from "pagopa-interop-commons-test";
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
  });
});
