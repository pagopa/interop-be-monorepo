/* eslint-disable functional/immutable-data */
import {
  getMockContext,
  getMockDescriptor,
  getMockEService,
  getMockEServiceTemplate,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  descriptorState,
  EService,
  EServiceId,
  EServiceTemplate,
  generateId,
  missingKafkaMessageDataError,
  TenantId,
  toEServiceTemplateV2,
  UserId,
} from "pagopa-interop-models";
import {
  getNotificationRecipients,
  inAppTemplates,
} from "pagopa-interop-notification-commons";
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";

import { handleEserviceTemplateNameChangedToInstantiator } from "../src/handlers/eserviceTemplates/handleEserviceTemplateNameChangedToInstantiator.js";
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
      `oldName - ${eservice1.instanceLabel}`,
      `${eserviceTemplate.name} - ${eservice1.instanceLabel}`
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

  it("should include the instance label in the old and new e-service names", async () => {
    const oldTemplateName = "eservice-template-807838540-0";
    const newTemplateName = "eservice-template-807838540-1";
    const instanceLabel = "istanza";
    const renamedTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      name: newTemplateName,
    };
    const producerId = generateId<TenantId>();
    const instance: EService = {
      ...getMockEService(
        generateId<EServiceId>(),
        producerId,
        [getMockDescriptor(descriptorState.published)],
        renamedTemplate.id
      ),
      name: `${oldTemplateName} - ${instanceLabel}`,
      instanceLabel,
    };
    const users = [{ userId: generateId<UserId>(), tenantId: producerId }];
    mockGetNotificationRecipients.mockResolvedValue(users);
    readModelService.getEServicesByTemplateId = vi
      .fn()
      .mockResolvedValue([instance]);

    const notifications = await handleEserviceTemplateNameChangedToInstantiator(
      toEServiceTemplateV2(renamedTemplate),
      oldTemplateName,
      logger,
      readModelService
    );

    const expectedBody =
      `Ti informiamo che il tuo e-service ${oldTemplateName} - ${instanceLabel} ` +
      `è stato rinominato in ${newTemplateName} - ${instanceLabel} in quanto ` +
      "è stato modificato il template e-service da cui lo hai generato.";

    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.body).toBe(expectedBody);
  });

  it("should not add any suffix when the instance has no instance label", async () => {
    const oldTemplateName = "eservice-template-807838540-0";
    const newTemplateName = "eservice-template-807838540-1";
    const renamedTemplate: EServiceTemplate = {
      ...getMockEServiceTemplate(),
      name: newTemplateName,
    };
    const producerId = generateId<TenantId>();
    const instance: EService = {
      ...getMockEService(
        generateId<EServiceId>(),
        producerId,
        [getMockDescriptor(descriptorState.published)],
        renamedTemplate.id
      ),
      name: oldTemplateName,
      instanceLabel: undefined,
    };
    const users = [{ userId: generateId<UserId>(), tenantId: producerId }];
    mockGetNotificationRecipients.mockResolvedValue(users);
    readModelService.getEServicesByTemplateId = vi
      .fn()
      .mockResolvedValue([instance]);

    const notifications = await handleEserviceTemplateNameChangedToInstantiator(
      toEServiceTemplateV2(renamedTemplate),
      oldTemplateName,
      logger,
      readModelService
    );

    const expectedBody =
      `Ti informiamo che il tuo e-service ${oldTemplateName} ` +
      `è stato rinominato in ${newTemplateName} in quanto ` +
      "è stato modificato il template e-service da cui lo hai generato.";

    expect(notifications).toHaveLength(1);
    expect(notifications[0]?.body).toBe(expectedBody);
  });
});
