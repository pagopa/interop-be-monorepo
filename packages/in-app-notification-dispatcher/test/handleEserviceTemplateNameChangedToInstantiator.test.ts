/* eslint-disable functional/immutable-data */
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import {
  getMockContext,
  getMockDescriptor,
  getMockEService,
  getMockEServiceTemplate,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  descriptorState,
  EServiceId,
  generateId,
  missingKafkaMessageDataError,
  TenantId,
  toEServiceTemplateV2,
} from "pagopa-interop-models";
import { getNotificationRecipients } from "../src/handlers/handlerCommons.js";
import { handleEserviceTemplateNameChangedToInstantiator } from "../src/handlers/eserviceTemplates/handleEserviceTemplateNameChangedToInstantiator.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import {
  addOneEService,
  addOneEServiceTemplate,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handleEserviceTemplateNameChangedToInstantiator", async () => {
  const eserviceTemplate = getMockEServiceTemplate();
  const eserviceTemplateV2 = toEServiceTemplateV2(eserviceTemplate);
  const { logger } = getMockContext({});

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;
  await addOneEServiceTemplate(eserviceTemplate);
  const creatorId = eserviceTemplate.creatorId;
  const creatorTenant = getMockTenant(creatorId);
  await addOneTenant(creatorTenant);

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
  });

  it("should throw missingKafkaMessageDataError when eserviceTemplateV2Msg is undefined", async () => {
    await expect(() =>
      handleEserviceTemplateNameChangedToInstantiator(
        undefined,
        undefined,
        logger,
        readModelService
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eserviceTemplate",
        "EServiceTemplateNameUpdated"
      )
    );
  });

  it("should return empty array when no user notification configs exist for the template", async () => {
    mockGetNotificationRecipients.mockResolvedValue([]);
    readModelService.getTenantById = vi.fn().mockResolvedValue(creatorTenant);

    const notifications = await handleEserviceTemplateNameChangedToInstantiator(
      eserviceTemplateV2,
      "oldName",
      logger,
      readModelService
    );

    expect(notifications).toEqual([]);
  });

  it("should return empty array when no eservices exist for the template", async () => {
    const users = [
      { userId: generateId(), tenantId: creatorId },
      { userId: generateId(), tenantId: creatorId },
    ];
    mockGetNotificationRecipients.mockResolvedValue(users);
    readModelService.getTenantById = vi.fn().mockResolvedValue(creatorTenant);

    readModelService.getEServicesByTemplateId = vi.fn().mockResolvedValue([]);

    const notifications = await handleEserviceTemplateNameChangedToInstantiator(
      eserviceTemplateV2,
      "oldName",
      logger,
      readModelService
    );

    expect(notifications).toEqual([]);
  });

  it("should generate notifications for all tenant users with notification enabled", async () => {
    const producerId = generateId<TenantId>();
    const producerTenant = getMockTenant(producerId);
    await addOneTenant(producerTenant);

    const eservice1 = getMockEService(
      generateId<EServiceId>(),
      producerId,
      [getMockDescriptor(descriptorState.published)],
      eserviceTemplate.id
    );
    const eservice2 = getMockEService(
      generateId<EServiceId>(),
      producerId,
      [getMockDescriptor(descriptorState.published)],
      eserviceTemplate.id
    );
    await addOneEService(eservice1);
    await addOneEService(eservice2);

    const users = [
      { userId: generateId(), tenantId: producerId },
      { userId: generateId(), tenantId: producerId },
    ];
    mockGetNotificationRecipients.mockResolvedValue(users);
    readModelService.getTenantById = vi.fn().mockResolvedValue(creatorTenant);

    readModelService.getEServicesByTemplateId = vi
      .fn()
      .mockResolvedValue([eservice1, eservice2]);

    const notifications = await handleEserviceTemplateNameChangedToInstantiator(
      eserviceTemplateV2,
      "oldName",
      logger,
      readModelService
    );

    const body = inAppTemplates.eserviceTemplateNameChangedToInstantiator(
      eserviceTemplate,
      "oldName"
    );

    const expectedNotifications = users.flatMap((user) => [
      {
        userId: user.userId,
        tenantId: producerId,
        body,
        notificationType: "eserviceTemplateNameChangedToInstantiator",
        entityId: `${eservice1.id}/${eservice1.descriptors[0].id}`,
      },
      {
        userId: user.userId,
        tenantId: producerId,
        body,
        notificationType: "eserviceTemplateNameChangedToInstantiator",
        entityId: `${eservice2.id}/${eservice2.descriptors[0].id}`,
      },
    ]);

    expect(notifications).toHaveLength(users.length * 2);
    expect(notifications).toEqual(
      expect.arrayContaining(expectedNotifications)
    );
  });
});
