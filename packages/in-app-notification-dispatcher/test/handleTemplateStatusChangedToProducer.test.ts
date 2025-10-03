/* eslint-disable functional/immutable-data */
import { describe, it, expect, beforeEach, Mock } from "vitest";
import {
  getMockContext,
  getMockEServiceTemplate,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  generateId,
  missingKafkaMessageDataError,
  TenantId,
  toEServiceTemplateV2,
} from "pagopa-interop-models";
import { getNotificationRecipients } from "../src/handlers/handlerCommons.js";
import { handleTemplateStatusChangedToProducer } from "../src/handlers/eserviceTemplates/handleTemplateStatusChangedToProducer.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import {
  addOneEServiceTemplate,
  addOneTenant,
  readModelService,
  mockUserService,
} from "./utils.js";

describe("handleTemplateStatusChangedToProducer", async () => {
  const eserviceTemplate = getMockEServiceTemplate();
  const { logger } = getMockContext({});

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;
  await addOneEServiceTemplate(eserviceTemplate);

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
  });

  it("should throw missingKafkaMessageDataError when eserviceTemplate is undefined", async () => {
    await expect(() =>
      handleTemplateStatusChangedToProducer(
        undefined,
        logger,
        readModelService,
        mockUserService
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eserviceTemplate",
        "EServiceTemplateVersionSuspended"
      )
    );
  });

  it("should return empty array when no user notification configs exist for the template", async () => {
    mockGetNotificationRecipients.mockResolvedValue([]);

    const notifications = await handleTemplateStatusChangedToProducer(
      toEServiceTemplateV2(eserviceTemplate),
      logger,
      readModelService,
      mockUserService
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
    mockGetNotificationRecipients.mockResolvedValue(users);

    const notifications = await handleTemplateStatusChangedToProducer(
      toEServiceTemplateV2(eserviceTemplate),
      logger,
      readModelService,
      mockUserService
    );

    const body = inAppTemplates.templateStatusChangedToProducer(
      eserviceTemplate.name
    );
    const expectedNotifications = users.map((user) => ({
      userId: user.userId,
      tenantId: creatorId,
      body,
      notificationType: "templateStatusChangedToProducer",
      entityId: eserviceTemplate.id,
    }));
    expect(notifications).toHaveLength(users.length);
    expect(notifications).toEqual(
      expect.arrayContaining(expectedNotifications)
    );
  });
});
