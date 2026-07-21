/* eslint-disable functional/immutable-data */
import { authRole } from "pagopa-interop-commons";
import {
  getMockAgreement,
  getMockContext,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Agreement,
  agreementState,
  archivingScope,
  CorrelationId,
  Descriptor,
  DescriptorId,
  descriptorState,
  EService,
  EServiceId,
  generateId,
  missingKafkaMessageDataError,
  TenantId,
  toEServiceV2,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleEserviceDescriptorArchivingCompletedToConsumer } from "../src/handlers/eservices/handleEserviceDescriptorArchivingCompletedToConsumer.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleEserviceDescriptorArchivingCompletedToConsumer", () => {
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const producerTenant = { ...getMockTenant(producerId), name: "Producer T" };
  const consumerTenant = { ...getMockTenant(consumerId), name: "Consumer T" };

  const archivingDescriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.archiving),
    archivingSchedule: {
      archivableOn: new Date("2026-12-31T00:00:00.000Z"),
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
      scope: archivingScope.descriptor,
    },
  };
  const eservice: EService = {
    ...getMockEService(),
    name: "Test E-service",
    producerId,
    descriptors: [archivingDescriptor],
  };
  const users = [
    getMockUser(consumerTenant.id),
    getMockUser(consumerTenant.id),
  ];

  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneEService(eservice);
    await addOneTenant(producerTenant);
    await addOneTenant(consumerTenant);
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
      handleEserviceDescriptorArchivingCompletedToConsumer({
        eserviceV2Msg: undefined,
        descriptorId: archivingDescriptor.id,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eservice",
        "EServiceDescriptorArchivingCompleted"
      )
    );
  });

  it("emits one email per consumer user", async () => {
    const agreement: Agreement = {
      ...getMockAgreement(),
      stamps: {},
      eserviceId: eservice.id,
      producerId,
      descriptorId: archivingDescriptor.id,
      consumerId: consumerTenant.id,
      state: agreementState.active,
    };
    await addOneAgreement(agreement);

    const messages = await handleEserviceDescriptorArchivingCompletedToConsumer(
      {
        eserviceV2Msg: toEServiceV2(eservice),
        descriptorId: archivingDescriptor.id,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      }
    );
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages[0].email.subject).toContain(
      "La versione di un e-service con cui stai scambiando dati è stata archiviata"
    );
  });

  it("returns empty array when there are no agreements", async () => {
    const otherDescriptor: Descriptor = {
      ...archivingDescriptor,
      id: generateId<DescriptorId>(),
    };
    const otherEservice: EService = {
      ...getMockEService(),
      id: generateId<EServiceId>(),
      producerId,
      descriptors: [otherDescriptor],
    };
    await addOneEService(otherEservice);
    const messages = await handleEserviceDescriptorArchivingCompletedToConsumer(
      {
        eserviceV2Msg: toEServiceV2(otherEservice),
        descriptorId: otherDescriptor.id,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      }
    );
    expect(messages).toEqual([]);
  });
});
