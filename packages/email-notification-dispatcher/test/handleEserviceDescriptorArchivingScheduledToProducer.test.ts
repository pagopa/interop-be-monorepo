/* eslint-disable functional/immutable-data */
import { authRole } from "pagopa-interop-commons";
import {
  getMockContext,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  CorrelationId,
  Descriptor,
  DescriptorId,
  descriptorState,
  EService,
  archivingScope,
  generateId,
  GracePeriodDays,
  gracePeriodDays,
  missingKafkaMessageDataError,
  TenantId,
  toEServiceV2,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleEserviceDescriptorArchivingScheduledToProducer } from "../src/handlers/eservices/handleEserviceDescriptorArchivingScheduledToProducer.js";
import {
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleEserviceDescriptorArchivingScheduledToProducer", () => {
  const producerId = generateId<TenantId>();
  const producerTenant = { ...getMockTenant(producerId), name: "Producer T" };

  const archivingDescriptorId = generateId<DescriptorId>();
  const getArchivingDescriptor = (
    gracePeriodDaysValue: GracePeriodDays
  ): Descriptor => ({
    ...getMockDescriptor(descriptorState.archiving),
    id: archivingDescriptorId,
    archivingSchedule: {
      archivableOn: new Date("2026-12-31T00:00:00.000Z"),
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
      scope: archivingScope.descriptor,
      gracePeriodDays: gracePeriodDaysValue,
    },
  });
  const users = [
    getMockUser(producerTenant.id),
    getMockUser(producerTenant.id),
  ];

  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneTenant(producerTenant);
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockImplementation((tenantIds: TenantId[]) =>
        users
          .filter((u) => tenantIds.includes(u.tenantId))
          .map((u) => ({
            userId: u.id,
            tenantId: u.tenantId,
            userRoles: [authRole.ADMIN_ROLE],
          }))
      );
  });

  it("throws missingKafkaMessageDataError when eservice is undefined", async () => {
    await expect(() =>
      handleEserviceDescriptorArchivingScheduledToProducer({
        eserviceV2Msg: undefined,
        descriptorId: archivingDescriptorId,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eservice",
        "EServiceDescriptorArchivingScheduled"
      )
    );
  });

  it.each([...gracePeriodDays])(
    "emits one email per producer user with the expected subject (gracePeriodDays: %d)",
    async (gracePeriodDaysValue: GracePeriodDays) => {
      const archivingDescriptor = getArchivingDescriptor(gracePeriodDaysValue);
      const eservice: EService = {
        ...getMockEService(),
        name: "Test E-service",
        producerId,
        descriptors: [archivingDescriptor],
      };
      await addOneEService(eservice);

      const messages =
        await handleEserviceDescriptorArchivingScheduledToProducer({
          eserviceV2Msg: toEServiceV2(eservice),
          descriptorId: archivingDescriptor.id,
          logger,
          templateService,
          readModelService,
          correlationId: generateId<CorrelationId>(),
        });
      expect(messages).toHaveLength(users.length);
      expect(messages[0].email.subject).toContain(
        "Una versione di un tuo e-service è in fase di archiviazione"
      );
    }
  );
});
