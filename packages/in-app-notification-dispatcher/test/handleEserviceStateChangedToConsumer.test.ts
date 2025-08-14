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
  type EServiceEventV2,
  type EServiceDescriptorPublishedV2,
  EServiceNameUpdatedV2,
} from "pagopa-interop-models";
import { handleEserviceStateChangedToConsumer } from "../src/handlers/eservices/handleEserviceStateChangedToConsumer.js";
import { tenantNotFound } from "../src/models/errors.js";
import { inAppTemplates } from "../src/templates/inAppTemplates.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handleEserviceStateChangedToConsumer for EServiceDescriptorPublished", async () => {
  const eservice = {
    ...getMockEService(),
    producerId: generateId<TenantId>(),
    descriptors: [getMockDescriptorPublished()],
  };
  const { logger } = getMockContext({});
  await addOneEService(eservice);

  it("should throw missingKafkaMessageDataError when eservice is undefined", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorPublished",
      data: {
        eservice: undefined,
        descriptorId: eservice.descriptors[0].id,
      } satisfies EServiceDescriptorPublishedV2,
    };

    await expect(() =>
      handleEserviceStateChangedToConsumer(msg, logger, readModelService)
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "EServiceDescriptorPublished")
    );
  });

  it("should return empty array when no agreements exist for the eservice", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorPublished",
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: eservice.descriptors[0].id,
      } satisfies EServiceDescriptorPublishedV2,
    };

    const notifications = await handleEserviceStateChangedToConsumer(
      msg,
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

    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorPublished",
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: eservice.descriptors[0].id,
      } satisfies EServiceDescriptorPublishedV2,
    };

    await expect(() =>
      handleEserviceStateChangedToConsumer(msg, logger, readModelService)
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
    "should generate notifications for EServiceDescriptorPublished for agreement in $state state (isNotified: $isNotified)",
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

      const msg: EServiceEventV2 = {
        event_version: 2,
        type: "EServiceDescriptorPublished",
        data: {
          eservice: toEServiceV2(eservice),
          descriptorId: eservice.descriptors[0].id,
        } satisfies EServiceDescriptorPublishedV2,
      };

      const notifications = await handleEserviceStateChangedToConsumer(
        msg,
        logger,
        readModelService
      );

      const expectedNotifications = isNotified ? users.length : 0;
      expect(notifications).toHaveLength(expectedNotifications);
      if (isNotified) {
        const body = inAppTemplates.eserviceDescriptorPublishedToConsumer(
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

  it("generate notifications for EServiceNameUpdated and EServiceNameUpdatedByTemplateUpdate", async () => {
    const eservice = {
      ...getMockEService(),
      descriptors: [getMockDescriptorPublished()],
    };
    await addOneEService(eservice);

    const consumerId = generateId<TenantId>();
    const consumerTenant = getMockTenant(consumerId);
    await addOneTenant(consumerTenant);

    const agreement = getMockAgreement(
      eservice.id,
      consumerId,
      agreementState.active
    );
    await addOneAgreement(agreement);

    const users = [
      { userId: generateId(), tenantId: consumerId },
      { userId: generateId(), tenantId: consumerId },
    ];
    // eslint-disable-next-line functional/immutable-data
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue(users);

    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceNameUpdated",
      data: {
        eservice: toEServiceV2(eservice),
      } satisfies EServiceNameUpdatedV2,
    };

    const notifications = await handleEserviceStateChangedToConsumer(
      msg,
      logger,
      readModelService
    );

    const body = inAppTemplates.eserviceNameUpdatedToConsumer(eservice.name);
    // eslint-disable-next-line sonarjs/no-identical-functions
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

    const msgByTemplateUpdate: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceNameUpdatedByTemplateUpdate",
      data: {
        eservice: toEServiceV2(eservice),
      } satisfies EServiceNameUpdatedV2,
    };

    const notificationsByTemplateUpdate =
      await handleEserviceStateChangedToConsumer(
        msgByTemplateUpdate,
        logger,
        readModelService
      );

    const bodyByTemplateUpdate = inAppTemplates.eserviceNameUpdatedToConsumer(
      eservice.name
    );
    // eslint-disable-next-line sonarjs/no-identical-functions
    const expectedNotificationsByTemplateUpdate = users.map((user) => ({
      userId: user.userId,
      tenantId: consumerId,
      body: bodyByTemplateUpdate,
      notificationType: "eserviceStateChangedToConsumer",
      entityId: eservice.descriptors[0].id,
    }));
    expect(notificationsByTemplateUpdate).toEqual(
      expect.arrayContaining(expectedNotificationsByTemplateUpdate)
    );
  });

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

    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorPublished",
      data: {
        eservice: toEServiceV2(eservice),
        descriptorId: eservice.descriptors[0].id,
      } satisfies EServiceDescriptorPublishedV2,
    };

    const notifications = await handleEserviceStateChangedToConsumer(
      msg,
      logger,
      readModelService
    );

    expect(notifications).toEqual([]);
  });
});
