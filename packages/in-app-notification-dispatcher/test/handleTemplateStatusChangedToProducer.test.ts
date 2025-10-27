/* eslint-disable functional/immutable-data */
import { describe, it, expect, vi } from "vitest";
import {
  getMockContext,
  getMockEServiceTemplate,
  getMockEServiceTemplateVersion,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  eserviceTemplateVersionState,
  generateId,
  missingKafkaMessageDataError,
  TenantId,
  toEServiceTemplateV2,
} from "pagopa-interop-models";
import { handleTemplateStatusChangedToProducer } from "../src/handlers/eserviceTemplates/handleTemplateStatusChangedToProducer.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import {
  addOneEServiceTemplate,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handleTemplateStatusChangedToProducer", async () => {
  const eserviceTemplate = getMockEServiceTemplate(undefined, undefined, [
    getMockEServiceTemplateVersion(
      undefined,
      eserviceTemplateVersionState.published
    ),
  ]);
  const { logger } = getMockContext({});
  await addOneEServiceTemplate(eserviceTemplate);

  it("should throw missingKafkaMessageDataError when eserviceTemplate is undefined", async () => {
    await expect(() =>
      handleTemplateStatusChangedToProducer(undefined, logger, readModelService)
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eserviceTemplate",
        "EServiceTemplateVersionSuspended"
      )
    );
  });

  it("should return empty array when no user notification configs exist for the template", async () => {
    const creatorId = generateId<TenantId>();
    const creatorTenant = getMockTenant(creatorId);
    await addOneTenant(creatorTenant);

    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([]);

    eserviceTemplate.creatorId = creatorId;
    const notifications = await handleTemplateStatusChangedToProducer(
      toEServiceTemplateV2(eserviceTemplate),
      logger,
      readModelService
    );

    expect(notifications).toEqual([]);
  });

  it("should generate notifications for all tenant users with notification enabled", async () => {
    const creatorId = generateId<TenantId>();
    const creatorTenant = getMockTenant(creatorId);
    await addOneTenant(creatorTenant);

    const users = [
      { userId: generateId(), tenantId: creatorId },
      { userId: generateId(), tenantId: creatorId },
    ];
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue(users);

    eserviceTemplate.creatorId = creatorId;
    const notifications = await handleTemplateStatusChangedToProducer(
      toEServiceTemplateV2(eserviceTemplate),
      logger,
      readModelService
    );

    const body = inAppTemplates.templateStatusChangedToProducer(
      eserviceTemplate.name,
      creatorTenant.name
    );
    const expectedNotifications = users.map((user) => ({
      userId: user.userId,
      tenantId: creatorId,
      body,
      notificationType: "templateStatusChangedToProducer",
      entityId: `${eserviceTemplate.id}/${eserviceTemplate.versions[0].id}`,
    }));
    expect(notifications).toHaveLength(users.length);
    expect(notifications).toEqual(
      expect.arrayContaining(expectedNotifications)
    );
  });
});
