/* eslint-disable functional/immutable-data */
import {
  getMockAgreement,
  getMockContext,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
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
import { handleEserviceDescriptorArchivingCanceledToConsumer } from "../src/handlers/eservices/handleEserviceDescriptorArchivingCanceledToConsumer.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleEserviceDescriptorArchivingCanceledToConsumer", () => {
  const producerId = generateId<TenantId>();
  const consumerId = generateId<TenantId>();
  const producerTenant = { ...getMockTenant(producerId), name: "Producer T" };
  const consumerTenant = { ...getMockTenant(consumerId), name: "Consumer T" };

  const descriptor: Descriptor = {
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
    descriptors: [descriptor],
  };
  const users = [getMockUser(consumerTenant.id)];

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
      handleEserviceDescriptorArchivingCanceledToConsumer({
        eserviceV2Msg: undefined,
        descriptorId: descriptor.id,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eservice",
        "EServiceDescriptorArchivingCanceled"
      )
    );
  });

  it("emits one email per consumer user with the expected subject", async () => {
    const agreement: Agreement = {
      ...getMockAgreement(),
      stamps: {},
      eserviceId: eservice.id,
      producerId,
      descriptorId: descriptor.id,
      consumerId: consumerTenant.id,
      state: agreementState.active,
    };
    await addOneAgreement(agreement);

    const messages = await handleEserviceDescriptorArchivingCanceledToConsumer({
      eserviceV2Msg: toEServiceV2(eservice),
      descriptorId: descriptor.id,
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages[0].email.subject).toContain(
      'Annullata l\'archiviazione di una versione di "Test E-service"'
    );
  });

  it("returns empty array when there are no agreements", async () => {
    const otherDescriptor: Descriptor = {
      ...descriptor,
      id: generateId<DescriptorId>(),
    };
    const otherEservice: EService = {
      ...getMockEService(),
      id: generateId<EServiceId>(),
      producerId,
      descriptors: [otherDescriptor],
    };
    await addOneEService(otherEservice);
    const messages = await handleEserviceDescriptorArchivingCanceledToConsumer({
      eserviceV2Msg: toEServiceV2(otherEservice),
      descriptorId: otherDescriptor.id,
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages).toEqual([]);
  });
});
