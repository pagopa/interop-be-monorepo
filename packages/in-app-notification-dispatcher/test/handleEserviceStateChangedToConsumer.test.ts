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
import { config } from "../src/config/config.js";
import { handleEserviceStateChangedToConsumer } from "../src/handlers/eservices/handleEserviceStateChangedToConsumer.js";
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
      handleEserviceStateChangedToConsumer(undefined, logger, readModelService)
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "EServiceDescriptorPublished")
    );
  });

  it("should return empty array when no agreements exist for the eservice", async () => {
    const notifications = await handleEserviceStateChangedToConsumer(
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
      handleEserviceStateChangedToConsumer(
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

      const notifications = await handleEserviceStateChangedToConsumer(
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
          id: expect.any(String),
          createdAt: expect.any(Date),
          userId: user.userId,
          tenantId: consumerId,
          body,
          deepLink: `https://${config.interopFeBaseUrl}/ui/it/fruizione/catalogo-e-service/${eservice.id}/${eservice.descriptors[0].id}`,
          readAt: undefined,
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

    const notifications = await handleEserviceStateChangedToConsumer(
      toEServiceV2(eservice),
      logger,
      readModelService
    );

    expect(notifications).toEqual([]);
  });
});
