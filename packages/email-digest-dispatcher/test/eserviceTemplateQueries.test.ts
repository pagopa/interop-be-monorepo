import { describe, test, expect, beforeEach } from "vitest";
import {
  Tenant,
  eserviceTemplateVersionState,
  descriptorState,
} from "pagopa-interop-models";
import {
  eserviceTemplateToBaseDigest,
  popularEserviceTemplateToBaseDigest,
} from "../src/model/digestDataConverter.js";
import {
  readModelService,
  addOneTenant,
  addOneEService,
  createMockTenant,
  createMockEService,
  addOneEServiceTemplate,
  createMockEServiceTemplate,
  createMockEServiceTemplateVersion,
  createEServiceWithTemplate,
  createTemplateWithPublishedVersion,
  createTemplateWithVersions,
  createTemplateScenario,
  createEServiceWithTemplateAndDate,
  daysAgo,
  TEST_TIME_WINDOWS,
  TEST_LIMITS,
} from "./integrationUtils.js";

describe("ReadModelService - getNewEserviceTemplates", () => {
  // eslint-disable-next-line functional/no-let
  let consumer: Tenant;

  beforeEach(async () => {
    consumer = createMockTenant();
    await addOneTenant(consumer);
  });

  describe("Basic functionality", () => {
    test("should return empty array when consumer has no e-services using templates", async () => {
      const result = await readModelService.getNewEserviceTemplates(
        consumer.id
      );
      expect(result).toEqual([]);
    });

    test("should return empty array when no new template versions exist within time window", async () => {
      const { template, versionId } = createTemplateWithPublishedVersion(
        consumer.id,
        "1",
        TEST_TIME_WINDOWS.OUTSIDE_RANGE
      );
      await addOneEServiceTemplate(template);

      const eservice = createEServiceWithTemplate(
        consumer.id,
        template.id,
        versionId,
        {
          version: "1",
        }
      );
      await addOneEService(eservice);

      const result = await readModelService.getNewEserviceTemplates(
        consumer.id
      );
      expect(result).toEqual([]);
    });

    test("should return new template versions for templates used by consumer's e-services", async () => {
      const oldVersion = createMockEServiceTemplateVersion(
        eserviceTemplateVersionState.published,
        "1",
        new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      );

      const newCreatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const newVersion = createMockEServiceTemplateVersion(
        eserviceTemplateVersionState.published,
        "2",
        newCreatedAt,
        { publishedAt: newCreatedAt }
      );

      const template = createMockEServiceTemplate(consumer.id, {
        versions: [oldVersion, newVersion],
      });
      await addOneEServiceTemplate(template);

      const eservice = createEServiceWithTemplate(
        consumer.id,
        template.id,
        oldVersion.id,
        {
          version: "1",
        }
      );
      await addOneEService(eservice);

      const result = await readModelService.getNewEserviceTemplates(
        consumer.id
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        eserviceTemplateId: template.id,
        eserviceTemplateName: template.name,
        eserviceTemplateProducerId: consumer.id,
        totalCount: 1,
      });
    });
  });

  describe("Version comparison logic", () => {
    test("should only return templates with newer versions than currently used", async () => {
      const { template } = await createTemplateScenario(consumer.id, {
        usedVersion: "1",
        newVersions: [
          {
            version: "2",
            state: eserviceTemplateVersionState.published,
            daysAgo: TEST_TIME_WINDOWS.WITHIN_RANGE,
          },
        ],
      });

      const result = await readModelService.getNewEserviceTemplates(
        consumer.id
      );

      expect(result).toHaveLength(1);
      expect(result[0].eserviceTemplateId).toBe(template.id);
    });

    test("should handle multi-digit version comparisons properly", async () => {
      const { template } = await createTemplateScenario(consumer.id, {
        usedVersion: "5",
        newVersions: [
          {
            version: "12",
            state: eserviceTemplateVersionState.published,
            daysAgo: TEST_TIME_WINDOWS.WITHIN_RANGE,
          },
        ],
      });

      const result = await readModelService.getNewEserviceTemplates(
        consumer.id
      );

      expect(result).toHaveLength(1);
      expect(result[0].eserviceTemplateId).toBe(template.id);
    });

    test("should not return templates with same version as currently used", async () => {
      await createTemplateScenario(consumer.id, {
        usedVersion: "1",
        newVersions: [],
      });

      const result = await readModelService.getNewEserviceTemplates(
        consumer.id
      );

      expect(result).toEqual([]);
    });
  });

  describe("Time window filtering", () => {
    test("should only return template versions published within last 7 days", async () => {
      const oldVersion = createMockEServiceTemplateVersion(
        eserviceTemplateVersionState.published,
        "1",
        new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      );

      const recentCreatedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const recentVersion = createMockEServiceTemplateVersion(
        eserviceTemplateVersionState.published,
        "2",
        recentCreatedAt,
        { publishedAt: recentCreatedAt }
      );

      const template = createMockEServiceTemplate(consumer.id, {
        versions: [oldVersion, recentVersion],
      });
      await addOneEServiceTemplate(template);

      const eservice = createEServiceWithTemplate(
        consumer.id,
        template.id,
        oldVersion.id,
        {
          version: "1",
        }
      );
      await addOneEService(eservice);

      const result = await readModelService.getNewEserviceTemplates(
        consumer.id
      );

      expect(result).toHaveLength(1);
    });

    test("should exclude template versions published more than 7 days ago", async () => {
      await createTemplateScenario(consumer.id, {
        usedVersion: "1",
        newVersions: [
          {
            version: "2",
            state: eserviceTemplateVersionState.published,
            daysAgo: TEST_TIME_WINDOWS.OUTSIDE_RANGE,
          },
        ],
      });

      const result = await readModelService.getNewEserviceTemplates(
        consumer.id
      );

      expect(result).toEqual([]);
    });
  });

  describe("Template version state filtering", () => {
    test("should only return templates with Published state", async () => {
      const publishedCreatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const { template, versionIds } = createTemplateWithVersions(consumer.id, [
        {
          version: "1",
          state: eserviceTemplateVersionState.published,
          daysAgo: 10,
        },
        {
          version: "2",
          state: eserviceTemplateVersionState.published,
          daysAgo: 2,
        },
      ]);
      // eslint-disable-next-line functional/immutable-data
      template.versions[1].publishedAt = publishedCreatedAt;
      await addOneEServiceTemplate(template);

      const eservice = createEServiceWithTemplate(
        consumer.id,
        template.id,
        versionIds[0],
        {
          version: "1",
        }
      );
      await addOneEService(eservice);

      const result = await readModelService.getNewEserviceTemplates(
        consumer.id
      );

      expect(result).toHaveLength(1);
    });

    test("should not return templates in Draft or other states", async () => {
      const { template, versionIds } = createTemplateWithVersions(consumer.id, [
        {
          version: "1",
          state: eserviceTemplateVersionState.published,
          daysAgo: 10,
        },
        { version: "2", state: eserviceTemplateVersionState.draft, daysAgo: 2 },
      ]);
      await addOneEServiceTemplate(template);

      const eservice = createEServiceWithTemplate(
        consumer.id,
        template.id,
        versionIds[0],
        {
          version: "1",
        }
      );
      await addOneEService(eservice);

      const result = await readModelService.getNewEserviceTemplates(
        consumer.id
      );

      expect(result).toEqual([]);
    });
  });

  describe("Ordering and usage count", () => {
    test("should order results by template usage count (descending) then creation date (ascending)", async () => {
      // Create template 1 with 2 uses
      const { template: template1 } = await createTemplateScenario(
        consumer.id,
        {
          usedVersion: "1",
          newVersions: [
            {
              version: "2",
              state: eserviceTemplateVersionState.published,
              daysAgo: TEST_TIME_WINDOWS.THREE_DAYS_AGO,
            },
          ],
          eserviceCount: 2,
        }
      );

      // Create template 2 with 5 uses (should come first)
      const { template: template2 } = await createTemplateScenario(
        consumer.id,
        {
          usedVersion: "1",
          newVersions: [
            {
              version: "2",
              state: eserviceTemplateVersionState.published,
              daysAgo: TEST_TIME_WINDOWS.FOUR_DAYS_AGO,
            },
          ],
          eserviceCount: 5,
        }
      );

      const result = await readModelService.getNewEserviceTemplates(
        consumer.id
      );

      expect(result).toHaveLength(2);
      expect(result[0].eserviceTemplateId).toBe(template2.id);
      expect(result[1].eserviceTemplateId).toBe(template1.id);
    });
  });

  describe("Limit and pagination", () => {
    test("should respect the 5-item limit when more templates are available", async () => {
      // Create 7 templates with new versions
      const templatePromises = Array.from({ length: 7 }, () =>
        createTemplateScenario(consumer.id, {
          usedVersion: "1",
          newVersions: [
            {
              version: "2",
              state: eserviceTemplateVersionState.published,
              daysAgo: TEST_TIME_WINDOWS.WITHIN_RANGE,
            },
          ],
        })
      );

      await Promise.all(templatePromises);

      const result = await readModelService.getNewEserviceTemplates(
        consumer.id
      );

      expect(result).toHaveLength(TEST_LIMITS.MAX_RESULTS);
    });
  });

  describe("Complex scenarios", () => {
    test("should handle consumer with multiple e-services using different templates", async () => {
      const { template: template1 } = await createTemplateScenario(
        consumer.id,
        {
          usedVersion: "1",
          newVersions: [
            {
              version: "2",
              state: eserviceTemplateVersionState.published,
              daysAgo: TEST_TIME_WINDOWS.WITHIN_RANGE,
            },
          ],
        }
      );

      const { template: template2 } = await createTemplateScenario(
        consumer.id,
        {
          usedVersion: "1",
          newVersions: [
            {
              version: "2",
              state: eserviceTemplateVersionState.published,
              daysAgo: TEST_TIME_WINDOWS.THREE_DAYS_AGO,
            },
          ],
        }
      );

      const result = await readModelService.getNewEserviceTemplates(
        consumer.id
      );

      expect(result).toHaveLength(2);
      const templateIds = result.map((r) => r.eserviceTemplateId);
      expect(templateIds).toContain(template1.id);
      expect(templateIds).toContain(template2.id);
    });

    test("should handle template with multiple new versions (return earliest)", async () => {
      const { template, versionIds } = await createTemplateScenario(
        consumer.id,
        {
          usedVersion: "1",
          newVersions: [
            {
              version: "2",
              state: eserviceTemplateVersionState.published,
              daysAgo: TEST_TIME_WINDOWS.FIVE_DAYS_AGO,
            },
            {
              version: "3",
              state: eserviceTemplateVersionState.published,
              daysAgo: TEST_TIME_WINDOWS.WITHIN_RANGE,
            },
          ],
        }
      );

      const result = await readModelService.getNewEserviceTemplates(
        consumer.id
      );

      expect(result).toHaveLength(1);
      expect(result[0].eserviceTemplateId).toBe(template.id);
      // Should return version 2 (published 5 days ago) as it's the earliest new version
      expect(result[0].eserviceTemplateVersionId).toBe(versionIds[1]);
    });

    test("should return correct version IDs for multiple templates with multiple versions", async () => {
      // Template 1: used version 1, new versions 2 (3 days ago) and 3 (1 day ago)
      const { template: template1, versionIds: versionIds1 } =
        await createTemplateScenario(consumer.id, {
          usedVersion: "1",
          newVersions: [
            {
              version: "2",
              state: eserviceTemplateVersionState.published,
              daysAgo: 3,
            },
            {
              version: "3",
              state: eserviceTemplateVersionState.published,
              daysAgo: 1,
            },
          ],
          eserviceCount: 5,
        });

      // Template 2: used version 1, new versions 2 (6 days ago) and 3 (2 days ago)
      const consumer2 = createMockTenant();
      await addOneTenant(consumer2);
      const { template: template2, versionIds: versionIds2 } =
        await createTemplateScenario(consumer.id, {
          usedVersion: "1",
          newVersions: [
            {
              version: "2",
              state: eserviceTemplateVersionState.published,
              daysAgo: 6,
            },
            {
              version: "3",
              state: eserviceTemplateVersionState.published,
              daysAgo: 2,
            },
          ],
          eserviceCount: 3,
        });

      const result = await readModelService.getNewEserviceTemplates(
        consumer.id
      );

      expect(result).toHaveLength(2);
      // Template 1 should come first (5 e-services vs 3)
      expect(result[0].eserviceTemplateId).toBe(template1.id);
      expect(result[0].eserviceTemplateVersionId).toBe(versionIds1[1]); // version 2 (3 days ago, earliest)
      expect(result[1].eserviceTemplateId).toBe(template2.id);
      expect(result[1].eserviceTemplateVersionId).toBe(versionIds2[1]); // version 2 (6 days ago, earliest)
    });
  });

  describe("Edge cases", () => {
    test("should handle e-services without templates (templateId is null)", async () => {
      const eserviceWithoutTemplate = createMockEService(consumer.id, {
        templateId: undefined,
      });
      await addOneEService(eserviceWithoutTemplate);

      const result = await readModelService.getNewEserviceTemplates(
        consumer.id
      );

      expect(result).toEqual([]);
    });
  });

  describe("Data integrity", () => {
    test("should return correctly typed results with proper structure", async () => {
      const { versionIds } = await createTemplateScenario(consumer.id, {
        usedVersion: "1",
        newVersions: [
          {
            version: "2",
            state: eserviceTemplateVersionState.published,
            daysAgo: TEST_TIME_WINDOWS.WITHIN_RANGE,
          },
        ],
      });

      const result = await readModelService.getNewEserviceTemplates(
        consumer.id
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("eserviceTemplateId");
      expect(result[0]).toHaveProperty("eserviceTemplateVersionId");
      expect(result[0]).toHaveProperty("eserviceTemplateName");
      expect(result[0]).toHaveProperty("eserviceTemplateProducerId");
      expect(result[0]).toHaveProperty("totalCount");
      expect(typeof result[0].eserviceTemplateId).toBe("string");
      expect(typeof result[0].eserviceTemplateVersionId).toBe("string");
      expect(typeof result[0].eserviceTemplateName).toBe("string");
      expect(typeof result[0].eserviceTemplateProducerId).toBe("string");
      expect(typeof result[0].totalCount).toBe("number");
      // Verify the correct version ID is returned (version 2, which is versionIds[1])
      expect(result[0].eserviceTemplateVersionId).toBe(versionIds[1]);
    });

    test("should include accurate totalCount in results", async () => {
      await createTemplateScenario(consumer.id, {
        usedVersion: "1",
        newVersions: [
          {
            version: "2",
            state: eserviceTemplateVersionState.published,
            daysAgo: TEST_TIME_WINDOWS.WITHIN_RANGE,
          },
        ],
      });

      const result = await readModelService.getNewEserviceTemplates(
        consumer.id
      );

      expect(result).toHaveLength(1);
      expect(result[0].totalCount).toBe(1);
    });
  });
});

describe("ReadModelService - getPopularEserviceTemplates", () => {
  // eslint-disable-next-line functional/no-let
  let creator: Tenant;

  beforeEach(async () => {
    creator = createMockTenant();
    await addOneTenant(creator);
  });

  describe("Basic functionality", () => {
    test("should return empty array when creator has no templates", async () => {
      const result = await readModelService.getPopularEserviceTemplates(
        creator.id
      );
      expect(result).toEqual([]);
    });

    test("should return empty array when templates have no recent eservice instances", async () => {
      // Create a template owned by the creator with a published version
      const publishedVersion = createMockEServiceTemplateVersion(
        eserviceTemplateVersionState.published,
        "1",
        daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE),
        { publishedAt: daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE) }
      );

      const template = createMockEServiceTemplate(creator.id, {
        versions: [publishedVersion],
      });
      await addOneEServiceTemplate(template);

      // Create an eservice using this template but created more than 7 days ago
      const producer = createMockTenant();
      await addOneTenant(producer);

      const eservice = createEServiceWithTemplateAndDate(
        producer.id,
        template.id,
        daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE)
      );
      await addOneEService(eservice);

      const result = await readModelService.getPopularEserviceTemplates(
        creator.id
      );
      expect(result).toEqual([]);
    });

    test("should return templates with recent eservice instances", async () => {
      // Create a template owned by the creator with a published version
      const publishedVersion = createMockEServiceTemplateVersion(
        eserviceTemplateVersionState.published,
        "1",
        daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE),
        { publishedAt: daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE) }
      );

      const template = createMockEServiceTemplate(creator.id, {
        versions: [publishedVersion],
      });
      await addOneEServiceTemplate(template);

      // Create an eservice using this template, created recently
      const producer = createMockTenant();
      await addOneTenant(producer);

      const eservice = createEServiceWithTemplateAndDate(
        producer.id,
        template.id,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
      );
      await addOneEService(eservice);

      const result = await readModelService.getPopularEserviceTemplates(
        creator.id
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        eserviceTemplateId: template.id,
        eserviceTemplateVersionId: publishedVersion.id,
        eserviceTemplateName: template.name,
        eserviceTemplateCreatorId: creator.id,
        instances: 1,
      });
    });
  });

  describe("Descriptor state filtering", () => {
    test("should only count eservices with published descriptors", async () => {
      // Create a template owned by the creator with a published version
      const publishedVersion = createMockEServiceTemplateVersion(
        eserviceTemplateVersionState.published,
        "1",
        daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE),
        { publishedAt: daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE) }
      );

      const template = createMockEServiceTemplate(creator.id, {
        versions: [publishedVersion],
      });
      await addOneEServiceTemplate(template);

      // Create a producer
      const producer = createMockTenant();
      await addOneTenant(producer);

      // Create an eservice with a draft descriptor (should not count)
      const draftEservice = createEServiceWithTemplateAndDate(
        producer.id,
        template.id,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE),
        descriptorState.draft
      );
      await addOneEService(draftEservice);

      const result = await readModelService.getPopularEserviceTemplates(
        creator.id
      );
      expect(result).toEqual([]);
    });
  });

  describe("Version selection", () => {
    test("should return the latest published template version", async () => {
      // Create a template with multiple published versions
      const oldVersion = createMockEServiceTemplateVersion(
        eserviceTemplateVersionState.published,
        "1",
        daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE),
        { publishedAt: daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE) }
      );

      const newerVersion = createMockEServiceTemplateVersion(
        eserviceTemplateVersionState.published,
        "2",
        daysAgo(TEST_TIME_WINDOWS.FIVE_DAYS_AGO),
        { publishedAt: daysAgo(TEST_TIME_WINDOWS.FIVE_DAYS_AGO) }
      );

      const template = createMockEServiceTemplate(creator.id, {
        versions: [oldVersion, newerVersion],
      });
      await addOneEServiceTemplate(template);

      // Create an eservice using this template
      const producer = createMockTenant();
      await addOneTenant(producer);

      const eservice = createEServiceWithTemplateAndDate(
        producer.id,
        template.id,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
      );
      await addOneEService(eservice);

      const result = await readModelService.getPopularEserviceTemplates(
        creator.id
      );

      expect(result).toHaveLength(1);
      expect(result[0].eserviceTemplateVersionId).toBe(newerVersion.id);
    });

    test("should not return templates with no published versions", async () => {
      // Create a template with only a draft version
      const draftVersion = createMockEServiceTemplateVersion(
        eserviceTemplateVersionState.draft,
        "1",
        daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE)
      );

      const template = createMockEServiceTemplate(creator.id, {
        versions: [draftVersion],
      });
      await addOneEServiceTemplate(template);

      // Create an eservice using this template
      const producer = createMockTenant();
      await addOneTenant(producer);

      const eservice = createEServiceWithTemplateAndDate(
        producer.id,
        template.id,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
      );
      await addOneEService(eservice);

      const result = await readModelService.getPopularEserviceTemplates(
        creator.id
      );
      expect(result).toEqual([]);
    });
  });

  describe("Instance counting", () => {
    test("should count distinct eservices correctly", async () => {
      // Create a template owned by the creator
      const publishedVersion = createMockEServiceTemplateVersion(
        eserviceTemplateVersionState.published,
        "1",
        daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE),
        { publishedAt: daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE) }
      );

      const template = createMockEServiceTemplate(creator.id, {
        versions: [publishedVersion],
      });
      await addOneEServiceTemplate(template);

      // Create multiple eservices using this template
      const producer1 = createMockTenant();
      const producer2 = createMockTenant();
      const producer3 = createMockTenant();
      await addOneTenant(producer1);
      await addOneTenant(producer2);
      await addOneTenant(producer3);

      const eservice1 = createEServiceWithTemplateAndDate(
        producer1.id,
        template.id,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
      );
      const eservice2 = createEServiceWithTemplateAndDate(
        producer2.id,
        template.id,
        daysAgo(TEST_TIME_WINDOWS.THREE_DAYS_AGO)
      );
      const eservice3 = createEServiceWithTemplateAndDate(
        producer3.id,
        template.id,
        daysAgo(TEST_TIME_WINDOWS.FIVE_DAYS_AGO)
      );

      await addOneEService(eservice1);
      await addOneEService(eservice2);
      await addOneEService(eservice3);

      const result = await readModelService.getPopularEserviceTemplates(
        creator.id
      );

      expect(result).toHaveLength(1);
      expect(result[0].instances).toBe(3);
    });
  });

  describe("Ordering and limits", () => {
    test("should order by instance count descending", async () => {
      // Create two templates
      const version1 = createMockEServiceTemplateVersion(
        eserviceTemplateVersionState.published,
        "1",
        daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE),
        { publishedAt: daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE) }
      );
      const template1 = createMockEServiceTemplate(creator.id, {
        versions: [version1],
      });

      const version2 = createMockEServiceTemplateVersion(
        eserviceTemplateVersionState.published,
        "1",
        daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE),
        { publishedAt: daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE) }
      );
      const template2 = createMockEServiceTemplate(creator.id, {
        versions: [version2],
      });

      await addOneEServiceTemplate(template1);
      await addOneEServiceTemplate(template2);

      // Create 2 eservices for template1
      const producer1 = createMockTenant();
      const producer2 = createMockTenant();
      await addOneTenant(producer1);
      await addOneTenant(producer2);

      await addOneEService(
        createEServiceWithTemplateAndDate(
          producer1.id,
          template1.id,
          daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
        )
      );
      await addOneEService(
        createEServiceWithTemplateAndDate(
          producer2.id,
          template1.id,
          daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
        )
      );

      // Create 5 eservices for template2
      // eslint-disable-next-line functional/no-let
      for (let i = 0; i < 5; i++) {
        const producer = createMockTenant();
        await addOneTenant(producer);
        await addOneEService(
          createEServiceWithTemplateAndDate(
            producer.id,
            template2.id,
            daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
          )
        );
      }

      const result = await readModelService.getPopularEserviceTemplates(
        creator.id
      );

      expect(result).toHaveLength(2);
      expect(result[0].eserviceTemplateId).toBe(template2.id);
      expect(result[0].instances).toBe(5);
      expect(result[1].eserviceTemplateId).toBe(template1.id);
      expect(result[1].instances).toBe(2);
    });

    test("should respect the 5-item limit", async () => {
      // Create 7 templates with instances
      // eslint-disable-next-line functional/no-let
      for (let i = 0; i < 7; i++) {
        const version = createMockEServiceTemplateVersion(
          eserviceTemplateVersionState.published,
          "1",
          daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE),
          { publishedAt: daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE) }
        );
        const template = createMockEServiceTemplate(creator.id, {
          versions: [version],
        });
        await addOneEServiceTemplate(template);

        const producer = createMockTenant();
        await addOneTenant(producer);
        await addOneEService(
          createEServiceWithTemplateAndDate(
            producer.id,
            template.id,
            daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
          )
        );
      }

      const result = await readModelService.getPopularEserviceTemplates(
        creator.id
      );

      expect(result).toHaveLength(TEST_LIMITS.MAX_RESULTS);
    });
  });

  describe("Data integrity", () => {
    test("should return correctly typed results with proper structure", async () => {
      // Create a template with a published version
      const publishedVersion = createMockEServiceTemplateVersion(
        eserviceTemplateVersionState.published,
        "1",
        daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE),
        { publishedAt: daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE) }
      );

      const template = createMockEServiceTemplate(creator.id, {
        versions: [publishedVersion],
      });
      await addOneEServiceTemplate(template);

      // Create an eservice using this template
      const producer = createMockTenant();
      await addOneTenant(producer);

      const eservice = createEServiceWithTemplateAndDate(
        producer.id,
        template.id,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
      );
      await addOneEService(eservice);

      const result = await readModelService.getPopularEserviceTemplates(
        creator.id
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("eserviceTemplateId");
      expect(result[0]).toHaveProperty("eserviceTemplateVersionId");
      expect(result[0]).toHaveProperty("eserviceTemplateName");
      expect(result[0]).toHaveProperty("eserviceTemplateCreatorId");
      expect(result[0]).toHaveProperty("instances");
      expect(result[0]).toHaveProperty("totalCount");

      expect(typeof result[0].eserviceTemplateId).toBe("string");
      expect(typeof result[0].eserviceTemplateVersionId).toBe("string");
      expect(typeof result[0].eserviceTemplateName).toBe("string");
      expect(typeof result[0].eserviceTemplateCreatorId).toBe("string");
      expect(typeof result[0].instances).toBe("number");
      expect(typeof result[0].totalCount).toBe("number");

      expect(result[0].eserviceTemplateId).toBe(template.id);
      expect(result[0].eserviceTemplateName).toBe(template.name);
      expect(result[0].eserviceTemplateCreatorId).toBe(creator.id);
      expect(result[0].instances).toBeGreaterThan(0);
      expect(result[0].totalCount).toBeGreaterThan(0);
    });

    test("should include accurate totalCount in results", async () => {
      // Create two templates with instances
      const version1 = createMockEServiceTemplateVersion(
        eserviceTemplateVersionState.published,
        "1",
        daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE),
        { publishedAt: daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE) }
      );
      const template1 = createMockEServiceTemplate(creator.id, {
        versions: [version1],
      });

      const version2 = createMockEServiceTemplateVersion(
        eserviceTemplateVersionState.published,
        "1",
        daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE),
        { publishedAt: daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE) }
      );
      const template2 = createMockEServiceTemplate(creator.id, {
        versions: [version2],
      });

      await addOneEServiceTemplate(template1);
      await addOneEServiceTemplate(template2);

      const producer1 = createMockTenant();
      const producer2 = createMockTenant();
      await addOneTenant(producer1);
      await addOneTenant(producer2);

      await addOneEService(
        createEServiceWithTemplateAndDate(
          producer1.id,
          template1.id,
          daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
        )
      );
      await addOneEService(
        createEServiceWithTemplateAndDate(
          producer2.id,
          template2.id,
          daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
        )
      );

      const result = await readModelService.getPopularEserviceTemplates(
        creator.id
      );

      expect(result).toHaveLength(2);
      expect(result[0].totalCount).toBe(2);
      expect(result[1].totalCount).toBe(2);
    });
  });
});

describe("DigestDataConverter - eserviceTemplate deeplinks", () => {
  // eslint-disable-next-line functional/no-let
  let consumer: Tenant;

  beforeEach(async () => {
    consumer = createMockTenant();
    await addOneTenant(consumer);
  });

  describe("eserviceTemplateToBaseDigest - Creator deeplinks", () => {
    test("should generate deeplink containing eserviceTemplateToCreator", async () => {
      await createTemplateScenario(consumer.id, {
        usedVersion: "1",
        newVersions: [
          {
            version: "2",
            state: eserviceTemplateVersionState.published,
            daysAgo: TEST_TIME_WINDOWS.WITHIN_RANGE,
          },
        ],
      });

      const queryResult = await readModelService.getNewEserviceTemplates(
        consumer.id
      );

      const digest = await eserviceTemplateToBaseDigest(
        queryResult,
        readModelService
      );

      expect(digest.items).toHaveLength(1);
      expect(digest.items[0].link).toContain("eserviceTemplateToCreator");
    });
  });

  describe("popularEserviceTemplateToBaseDigest - Instantiator deeplinks", () => {
    test("should generate deeplink containing eserviceTemplateToInstantiator", async () => {
      const creator = createMockTenant();
      await addOneTenant(creator);

      const publishedVersion = createMockEServiceTemplateVersion(
        eserviceTemplateVersionState.published,
        "1",
        daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE),
        { publishedAt: daysAgo(TEST_TIME_WINDOWS.OUTSIDE_RANGE) }
      );

      const template = createMockEServiceTemplate(creator.id, {
        versions: [publishedVersion],
      });
      await addOneEServiceTemplate(template);

      const producer = createMockTenant();
      await addOneTenant(producer);

      const eservice = createEServiceWithTemplateAndDate(
        producer.id,
        template.id,
        daysAgo(TEST_TIME_WINDOWS.WITHIN_RANGE)
      );
      await addOneEService(eservice);

      const queryResult = await readModelService.getPopularEserviceTemplates(
        creator.id
      );

      const digest = await popularEserviceTemplateToBaseDigest(
        queryResult,
        readModelService
      );

      expect(digest.items).toHaveLength(1);
      expect(digest.items[0].link).toContain("eserviceTemplateToInstantiator");
    });
  });
});
