import { describe, it, expect, vi } from "vitest";
import {
  getMockContext,
  getMockEService,
  getMockDescriptorPublished,
  getMockAgreement,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  agreementState,
  generateId,
  missingKafkaMessageDataError,
  TenantId,
  toEServiceV2,
} from "pagopa-interop-models";
<<<<<<<< HEAD:packages/in-app-notification-dispatcher/test/handleEserviceStateChangedToConsumer.test.ts
import { handleEserviceStateChangedToConsumer } from "../src/handlers/eservices/handleEserviceStateChangedToConsumer.js";
========
import { config } from "../src/config/config.js";
import { handleEserviceStatusChangedToConsumer } from "../src/handlers/eservices/handleEserviceStatusChangedToConsumer.js";
>>>>>>>> 7b279f863 (fix: correct spelling from "Instatiator" to "Instantiator" in notification config fields):packages/in-app-notification-dispatcher/test/handleEserviceStatusChangedToConsumer.test.ts
import { tenantNotFound } from "../src/models/errors.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handleEserviceStatusChangedToConsumer", async () => {
  const eservice = {
    ...getMockEService(),
    producerId: generateId<TenantId>(),
    descriptors: [getMockDescriptorPublished()],
  };
  const { logger } = getMockContext({});
  await addOneEService(eservice);

  it("should throw missingKafkaMessageDataError when eservice is undefined", async () => {
    await expect(() =>
<<<<<<<< HEAD:packages/in-app-notification-dispatcher/test/handleEserviceStateChangedToConsumer.test.ts
      handleEserviceStateChangedToConsumer(undefined, logger, readModelService)
========
      handleEserviceStatusChangedToConsumer(undefined, logger, readModelService)
>>>>>>>> 7b279f863 (fix: correct spelling from "Instatiator" to "Instantiator" in notification config fields):packages/in-app-notification-dispatcher/test/handleEserviceStatusChangedToConsumer.test.ts
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "EServiceDescriptorPublished")
    );
  });

  it("should return empty array when no agreements exist for the eservice", async () => {
<<<<<<<< HEAD:packages/in-app-notification-dispatcher/test/handleEserviceStateChangedToConsumer.test.ts
    const notifications = await handleEserviceStateChangedToConsumer(
========
    const notifications = await handleEserviceStatusChangedToConsumer(
>>>>>>>> 7b279f863 (fix: correct spelling from "Instatiator" to "Instantiator" in notification config fields):packages/in-app-notification-dispatcher/test/handleEserviceStatusChangedToConsumer.test.ts
      toEServiceV2(eservice),
      logger,
      readModelService
    );
    expect(notifications).toEqual([]);
  });

  it("should throw tenantNotFound when tenant is not found", async () => {
    const consumerId = generateId<TenantId>();
    const agreement = getMockAgreement(
      eservice.id,
      consumerId,
      agreementState.active
    );
    await addOneAgreement(agreement);

    await expect(() =>
<<<<<<<< HEAD:packages/in-app-notification-dispatcher/test/handleEserviceStateChangedToConsumer.test.ts
      handleEserviceStateChangedToConsumer(
========
      handleEserviceStatusChangedToConsumer(
>>>>>>>> 7b279f863 (fix: correct spelling from "Instatiator" to "Instantiator" in notification config fields):packages/in-app-notification-dispatcher/test/handleEserviceStatusChangedToConsumer.test.ts
        toEServiceV2(eservice),
        logger,
        readModelService
      )
    ).rejects.toThrow(tenantNotFound(consumerId));
  });

  it.each([
    { state: agreementState.pending, isNotified: true },
    { state: agreementState.active, isNotified: true },
    { state: agreementState.suspended, isNotified: true },
    { state: agreementState.archived, isNotified: false },
    {
      state: agreementState.missingCertifiedAttributes,
      isNotified: false,
    },
    { state: agreementState.rejected, isNotified: false },
  ])(
    "should generate notifications for all tenant users for agreement in $state state (isNotified: $isNotified)",
    async ({ state, isNotified }) => {
      const eservice = {
        ...getMockEService(),
        producerId: generateId<TenantId>(),
        descriptors: [getMockDescriptorPublished()],
      };
      await addOneEService(eservice);

      const consumerId = generateId<TenantId>();
      const consumerTenant = getMockTenant(consumerId);
      await addOneTenant(consumerTenant);

      const agreement = getMockAgreement(eservice.id, consumerId, state);
      await addOneAgreement(agreement);

      const users = [
        { userId: generateId(), tenantId: consumerId },
        { userId: generateId(), tenantId: consumerId },
      ];
      // eslint-disable-next-line functional/immutable-data
      readModelService.getTenantUsersWithNotificationEnabled = vi
        .fn()
        .mockResolvedValue(users);

<<<<<<<< HEAD:packages/in-app-notification-dispatcher/test/handleEserviceStateChangedToConsumer.test.ts
      const notifications = await handleEserviceStateChangedToConsumer(
========
      const notifications = await handleEserviceStatusChangedToConsumer(
>>>>>>>> 7b279f863 (fix: correct spelling from "Instatiator" to "Instantiator" in notification config fields):packages/in-app-notification-dispatcher/test/handleEserviceStatusChangedToConsumer.test.ts
        toEServiceV2(eservice),
        logger,
        readModelService
      );

      const expectedNotifications = isNotified ? users.length : 0;
      expect(notifications).toHaveLength(expectedNotifications);
      if (isNotified) {
        const body = inAppTemplates.eserviceStateChangedToConsumer(
          eservice.name
        );
        const expectedNotifications = users.map((user) => ({
          userId: user.userId,
          tenantId: consumerId,
          body,
          notificationType: "eserviceStateChangedToConsumer",
          entityId: eservice.descriptors[0].id,
        }));
        expect(notifications).toEqual(
          expect.arrayContaining(expectedNotifications)
        );
      }
    }
  );

  it("should return empty array when no user notification configs exist for the eservice", async () => {
    const consumerId = generateId<TenantId>();
    const consumerTenant = getMockTenant(consumerId);
    const agreement = getMockAgreement(
      eservice.id,
      consumerId,
      agreementState.active
    );
    await addOneAgreement(agreement);
    await addOneTenant(consumerTenant);

    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([]);

<<<<<<<< HEAD:packages/in-app-notification-dispatcher/test/handleEserviceStateChangedToConsumer.test.ts
    const notifications = await handleEserviceStateChangedToConsumer(
========
    const notifications = await handleEserviceStatusChangedToConsumer(
>>>>>>>> 7b279f863 (fix: correct spelling from "Instatiator" to "Instantiator" in notification config fields):packages/in-app-notification-dispatcher/test/handleEserviceStatusChangedToConsumer.test.ts
      toEServiceV2(eservice),
      logger,
      readModelService
    );

    expect(notifications).toEqual([]);
  });
});
