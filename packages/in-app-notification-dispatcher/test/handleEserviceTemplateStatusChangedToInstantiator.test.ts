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
import { handleEserviceTemplateStatusChangedToInstantiator } from "../src/handlers/eserviceTemplates/handleEserviceTemplateStatusChangedToInstantiator.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import {
  addOneEService,
  addOneEServiceTemplate,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handleEserviceTemplateStatusChangedToInstantiator", async () => {
  const eserviceTemplate = getMockEServiceTemplate();
  const { logger } = getMockContext({});

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;
  await addOneEServiceTemplate(eserviceTemplate);

  // Mock the getEServicesByTemplateId method to return an empty array by default
  readModelService.getEServicesByTemplateId = vi.fn().mockResolvedValue([]);

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
  });

  it("should throw missingKafkaMessageDataError when eserviceTemplate is undefined", async () => {
    await expect(() =>
      handleEserviceTemplateStatusChangedToInstantiator(
        undefined,
        logger,
        readModelService
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eserviceTemplate",
        "EServiceTemplateVersionSuspended"
      )
    );
  });

  it("should return empty array when no user notification configs exist for the template", async () => {
    // Create a mock creator tenant for the template
    const creatorId = generateId<TenantId>();
    const creatorTenant = getMockTenant(creatorId);
    await addOneTenant(creatorTenant);

    // Set up the eserviceTemplate with the creatorId
    const updatedEServiceTemplate = {
      ...eserviceTemplate,
      creatorId,
    };

    // Update the EService template in the database
    await addOneEServiceTemplate(updatedEServiceTemplate);

    // Mock the getTenantById method to return the creator tenant
    readModelService.getTenantById = vi.fn().mockImplementation((tenantId) => {
      if (tenantId === creatorId) {
        return Promise.resolve(creatorTenant);
      }
      return Promise.resolve(null);
    });

    mockGetNotificationRecipients.mockResolvedValue([]);

    const notifications =
      await handleEserviceTemplateStatusChangedToInstantiator(
        toEServiceTemplateV2(updatedEServiceTemplate),
        logger,
        readModelService
      );

    expect(notifications).toEqual([]);
  });

  it("should generate notifications for all tenant users with notification enabled", async () => {
    const creatorId = generateId<TenantId>();
    const creatorTenant = getMockTenant(creatorId);
    await addOneTenant(creatorTenant);

    const producerId = generateId<TenantId>();
    const producerTenant = getMockTenant(producerId);
    await addOneTenant(producerTenant);

    // Set up the eserviceTemplate with the creatorId
    const updatedEServiceTemplate = {
      ...eserviceTemplate,
      creatorId,
    };
    await addOneEServiceTemplate(updatedEServiceTemplate);

    const eserviceId = generateId<EServiceId>();
    const eservice = getMockEService(
      eserviceId,
      producerId,
      [getMockDescriptor(descriptorState.published)],
      updatedEServiceTemplate.id
    );
    await addOneEService(eservice);

    const users = [
      { userId: generateId(), tenantId: producerId },
      { userId: generateId(), tenantId: producerId },
    ];

    readModelService.getEServicesByTemplateId = vi
      .fn()
      .mockResolvedValue([eservice]);
    mockGetNotificationRecipients.mockResolvedValue(users);

    readModelService.getTenantById = vi.fn().mockImplementation((tenantId) => {
      if (tenantId === creatorId) {
        return Promise.resolve(creatorTenant);
      }
      if (tenantId === producerId) {
        return Promise.resolve(producerTenant);
      }
      return Promise.resolve(null);
    });

    const notifications =
      await handleEserviceTemplateStatusChangedToInstantiator(
        toEServiceTemplateV2(updatedEServiceTemplate),
        logger,
        readModelService
      );

    const body = inAppTemplates.eserviceTemplateStatusChangedToInstantiator(
      creatorTenant.name,
      updatedEServiceTemplate.name
    );

    const expectedNotifications = users.map((user) => ({
      userId: user.userId,
      tenantId: producerId,
      body,
      notificationType: "eserviceTemplateStatusChangedToInstantiator",
      entityId: `${eserviceId}/${eservice.descriptors[0].id}`,
    }));

    expect(notifications).toHaveLength(users.length);
    expect(notifications).toEqual(
      expect.arrayContaining(expectedNotifications)
    );
  });
});
