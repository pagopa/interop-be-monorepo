/* eslint-disable functional/immutable-data */
import {
  getMockAgreement,
  getMockContext,
  getMockDescriptor,
  getMockDescriptorPublished,
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
  descriptorState,
  EService,
  EServiceId,
  generateId,
  missingKafkaMessageDataError,
  TenantId,
  toEServiceV2,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleEserviceDescriptorArchivedToConsumer } from "../src/handlers/eservices/handleEserviceDescriptorArchivedToConsumer.js";
import {
  addOneAgreement,
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleEserviceDescriptorArchivedToConsumer", () => {
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
      handleEserviceDescriptorArchivedToConsumer({
        eserviceV2Msg: undefined,
        descriptorId: archivingDescriptor.id,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "EServiceDescriptorArchived")
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

    const messages = await handleEserviceDescriptorArchivedToConsumer({
      eserviceV2Msg: toEServiceV2(eservice),
      descriptorId: archivingDescriptor.id,
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages[0].email.subject).toContain(
      "Archiviazione anticipata della versione"
    );
  });

  it("returns empty array when there are no agreements", async () => {
    const otherEservice: EService = {
      ...getMockEService(),
      id: generateId<EServiceId>(),
      producerId,
      descriptors: [archivingDescriptor],
    };
    await addOneEService(otherEservice);
    const messages = await handleEserviceDescriptorArchivedToConsumer({
      eserviceV2Msg: toEServiceV2(otherEservice),
      descriptorId: archivingDescriptor.id,
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages).toEqual([]);
  });

  it("includes consumers with archived agreements (early-archive path)", async () => {
    const archivedAgreement: Agreement = {
      ...getMockAgreement(),
      stamps: {},
      eserviceId: eservice.id,
      producerId,
      descriptorId: archivingDescriptor.id,
      consumerId: consumerTenant.id,
      state: agreementState.archived,
    };
    await addOneAgreement(archivedAgreement);
    const messages = await handleEserviceDescriptorArchivedToConsumer({
      eserviceV2Msg: toEServiceV2(eservice),
      descriptorId: archivingDescriptor.id,
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty array when archivingSchedule is absent on the descriptor (routine auto-archive)", async () => {
    const routineDescriptor: Descriptor = {
      ...getMockDescriptorPublished(),
    };
    const routineEservice: EService = {
      ...getMockEService(),
      id: generateId<EServiceId>(),
      producerId,
      descriptors: [routineDescriptor],
    };
    await addOneEService(routineEservice);

    const messages = await handleEserviceDescriptorArchivedToConsumer({
      eserviceV2Msg: toEServiceV2(routineEservice),
      descriptorId: routineDescriptor.id,
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages).toEqual([]);
  });
});
