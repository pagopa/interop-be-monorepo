import { describe, it, expect } from "vitest";
import {
  EServiceDescriptorPurposeTemplate,
  generateId,
  PurposeTemplate,
  TenantId,
  WithMetadata,
} from "pagopa-interop-models";
import { getMockPurposeTemplate } from "pagopa-interop-commons-test";
import { eq } from "drizzle-orm";
import { purposeTemplateInReadmodelPurposeTemplate } from "pagopa-interop-readmodel-models";
import {
  upsertPurposeTemplate,
  upsertPurposeTemplateEServiceDescriptor,
} from "../../src/testUtils.js";
import { readModelDB } from "../utils.js";
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

  describe("Get a Purpose Template by a custom filter", async () => {
    it("should get a purpose template by a custom filter", async () => {
      const creatorId = generateId<TenantId>();
      const purposeTemplate: PurposeTemplate = {
        ...getMockPurposeTemplate(),
        creatorId,
      };
      await upsertPurposeTemplate(readModelDB, purposeTemplate, 1);

      await upsertPurposeTemplate(readModelDB, getMockPurposeTemplate(), 1);

      const retrievedPurposeTemplate =
        await purposeTemplateReadModelService.getPurposeTemplateByFilter(
          eq(purposeTemplateInReadmodelPurposeTemplate.creatorId, creatorId)
        );

      expect(retrievedPurposeTemplate).toStrictEqual({
        data: purposeTemplate,
        metadata: { version: 1 },
      });
    });

    it("should *not* get a purpose template by a custom filter if not present", async () => {
      const retrievedPurposeTemplate =
        await purposeTemplateReadModelService.getPurposeTemplateByFilter(
          eq(purposeTemplateInReadmodelPurposeTemplate.creatorId, generateId())
        );

      expect(retrievedPurposeTemplate).toBeUndefined();
    });

    it("should throw error if multiple purpose templates are found by a custom filter", async () => {
      const creatorId = generateId<TenantId>();
      const purposeTemplate1: PurposeTemplate = {
        ...getMockPurposeTemplate(),
        creatorId,
      };
      await upsertPurposeTemplate(readModelDB, purposeTemplate1, 1);

      const purposeTemplate2: PurposeTemplate = {
        ...getMockPurposeTemplate(),
        creatorId,
      };
      await upsertPurposeTemplate(readModelDB, purposeTemplate2, 1);

      await upsertPurposeTemplate(readModelDB, getMockPurposeTemplate(), 1);

      await expect(
        purposeTemplateReadModelService.getPurposeTemplateByFilter(
          eq(purposeTemplateInReadmodelPurposeTemplate.creatorId, creatorId)
        )
      ).rejects.toThrowError();
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
          data: {
            purposeTemplateId: purposeTemplate.id,
            eserviceId: purposeTemplateEServiceDescriptor.eserviceId,
            descriptorId: purposeTemplateEServiceDescriptor.descriptorId,
            createdAt: purposeTemplateEServiceDescriptor.createdAt,
          },
          metadata: { version: metadataVersion },
        } satisfies WithMetadata<EServiceDescriptorPurposeTemplate>,
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
