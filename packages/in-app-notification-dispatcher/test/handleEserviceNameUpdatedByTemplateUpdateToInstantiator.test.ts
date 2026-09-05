import {
  getMockContext,
  getMockDescriptorPublished,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  EService,
  EServiceEventV2,
  EServiceNameUpdatedByTemplateUpdateV2,
  generateId,
  missingKafkaMessageDataError,
  toEServiceV2,
  UserId,
} from "pagopa-interop-models";
import {
  getNotificationRecipients,
  inAppTemplates,
} from "pagopa-interop-notification-commons";
import { describe, it, expect, beforeEach, Mock } from "vitest";

import { handleEserviceNameUpdatedByTemplateUpdateToInstantiator } from "../src/handlers/eservices/handleEserviceNameUpdatedByTemplateUpdateToInstantiator.js";
import { addOneEService, addOneTenant, readModelService } from "./utils.js";

type EServiceNameUpdatedByTemplateUpdateEvent = Extract<
  EServiceEventV2,
  { type: "EServiceNameUpdatedByTemplateUpdate" }
>;

describe("handleEserviceNameUpdatedByTemplateUpdateToInstantiator", () => {
  const instantiatorTenant = getMockTenant();
  const userId = generateId<UserId>();
  const { logger } = getMockContext({});

  const oldEserviceName = "eservice-template-807838540-0 - istanza";
  const newEserviceName = "eservice-template-807838540-1 - istanza";

  const instance: EService = {
    ...getMockEService(),
    producerId: instantiatorTenant.id,
    name: newEserviceName,
    descriptors: [getMockDescriptorPublished()],
  };

  const buildMessage = (
    oldName: string | undefined
  ): EServiceNameUpdatedByTemplateUpdateEvent => ({
    event_version: 2,
    type: "EServiceNameUpdatedByTemplateUpdate",
    data: {
      eservice: toEServiceV2(instance),
      oldName,
    } satisfies EServiceNameUpdatedByTemplateUpdateV2,
  });

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    mockGetNotificationRecipients.mockResolvedValue([
      { userId, tenantId: instantiatorTenant.id },
    ]);
    await addOneTenant(instantiatorTenant);
    await addOneEService(instance);
  });

  it("should throw missingKafkaMessageDataError when the eservice is undefined", async () => {
    const msg: EServiceNameUpdatedByTemplateUpdateEvent = {
      event_version: 2,
      type: "EServiceNameUpdatedByTemplateUpdate",
      data: {
        eservice: undefined,
        oldName: oldEserviceName,
      } satisfies EServiceNameUpdatedByTemplateUpdateV2,
    };

    await expect(() =>
      handleEserviceNameUpdatedByTemplateUpdateToInstantiator(
        msg,
        logger,
        readModelService
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eservice",
        "EServiceNameUpdatedByTemplateUpdate"
      )
    );
  });

  it("should return an empty array when the instantiator has no user with the notification enabled", async () => {
    mockGetNotificationRecipients.mockResolvedValue([]);

    const notifications =
      await handleEserviceNameUpdatedByTemplateUpdateToInstantiator(
        buildMessage(oldEserviceName),
        logger,
        readModelService
      );

    expect(notifications).toEqual([]);
  });

  it("should notify the instantiator with the old and new e-service names carried by the event", async () => {
    const notifications =
      await handleEserviceNameUpdatedByTemplateUpdateToInstantiator(
        buildMessage(oldEserviceName),
        logger,
        readModelService
      );

    expect(notifications).toEqual([
      {
        userId,
        tenantId: instantiatorTenant.id,
        body: inAppTemplates.eserviceTemplateNameChangedToInstantiator(
          oldEserviceName,
          newEserviceName
        ),
        notificationType: "eserviceTemplateNameChangedToInstantiator",
        entityId: `${instance.id}/${instance.descriptors[0].id}`,
      },
    ]);
  });

  it("should fall back to the e-service id when the event carries no old name", async () => {
    const notifications =
      await handleEserviceNameUpdatedByTemplateUpdateToInstantiator(
        buildMessage(undefined),
        logger,
        readModelService
      );

    expect(notifications[0]?.body).toBe(
      inAppTemplates.eserviceTemplateNameChangedToInstantiator(
        instance.id,
        newEserviceName
      )
    );
  });
});
