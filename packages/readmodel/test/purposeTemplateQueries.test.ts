import { describe, it, expect } from "vitest";
import {
  EServiceDescriptorPurposeTemplate,
  generateId,
} from "pagopa-interop-models";
import { getMockPurposeTemplate } from "pagopa-interop-commons-test";
import {
  upsertPurposeTemplate,
  upsertPurposeTemplateEServiceDescriptor,
} from "../src/testUtils.js";
import { readModelDB } from "./utils.js";
import { purposeTemplateReadModelService } from "./purposeTemplateUtils.js";

describe("Purpose template queries", () => {
  describe("Get a Purpose Template", async () => {
    it("should get a purpose template by id if present", async () => {
      const purposeTemplate = getMockPurposeTemplate();
      await upsertPurposeTemplate(readModelDB, purposeTemplate, 1);

      await upsertPurposeTemplate(readModelDB, getMockPurposeTemplate(), 1);

      const retrievedPurposeTemplate =
        await purposeTemplateReadModelService.getPurposeTemplateById(
          purposeTemplate.id
        );

      expect(retrievedPurposeTemplate).toStrictEqual({
        data: purposeTemplate,
        metadata: { version: 1 },
      });
    });

    it("should *not* get a purpose template by id if not present", async () => {
      const retrievedPurposeTemplate =
        await purposeTemplateReadModelService.getPurposeTemplateById(
          generateId()
        );

      expect(retrievedPurposeTemplate).toBeUndefined();
    });
  });

  describe("Get purpose template e-service descriptors", async () => {
    it("should get purpose template eservice descriptors by purpose template id if present", async () => {
      const metadataVersion = 1;
      const purposeTemplate = getMockPurposeTemplate();
      await upsertPurposeTemplate(
        readModelDB,
        purposeTemplate,
        metadataVersion
      );

      const purposeTemplateEServiceDescriptor: EServiceDescriptorPurposeTemplate =
        {
          purposeTemplateId: purposeTemplate.id,
          eserviceId: generateId(),
          descriptorId: generateId(),
          createdAt: new Date(),
        };
      await upsertPurposeTemplateEServiceDescriptor(
        readModelDB,
        purposeTemplateEServiceDescriptor,
        metadataVersion
      );

      const retrievedPurposeTemplateEServiceDescriptors =
        await purposeTemplateReadModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateId(
          purposeTemplate.id
        );

      expect(retrievedPurposeTemplateEServiceDescriptors).toStrictEqual([
        {
          purposeTemplateId: purposeTemplate.id,
          eserviceId: purposeTemplateEServiceDescriptor.eserviceId,
          descriptorId: purposeTemplateEServiceDescriptor.descriptorId,
          createdAt: purposeTemplateEServiceDescriptor.createdAt,
        },
      ]);
    });

    it("should *not* get purpose template eservice descriptors by purpose template id if not present", async () => {
      const retrievedPurposeTemplateEServiceDescriptors =
        await purposeTemplateReadModelService.getPurposeTemplateEServiceDescriptorsByPurposeTemplateId(
          generateId()
        );

      expect(retrievedPurposeTemplateEServiceDescriptors).toStrictEqual([]);
    });
  });
});
