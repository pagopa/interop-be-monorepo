/* eslint-disable functional/immutable-data */
import { authRole } from "pagopa-interop-commons";
import {
  getMockContext,
  getMockDescriptor,
  getMockDescriptorPublished,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  CorrelationId,
  Descriptor,
  descriptorState,
  EService,
  EServiceId,
  archivingScope,
  generateId,
  missingKafkaMessageDataError,
  TenantId,
  toEServiceV2,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleEserviceDescriptorArchivedToProducer } from "../src/handlers/eservices/handleEserviceDescriptorArchivedToProducer.js";
import {
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleEserviceDescriptorArchivedToProducer", () => {
  const producerId = generateId<TenantId>();
  const producerTenant = { ...getMockTenant(producerId), name: "Producer T" };

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
    getMockUser(producerTenant.id),
    getMockUser(producerTenant.id),
  ];

  const { logger } = getMockContext({});

  const expectedMessageSubject =
    /La versione \d+ dell'e-service "[^"]+" è stata archiviata il giorno \d{2}\/\d{2}\/\d{4} perché senza fruitori. Da ora non è più attiva./;

  beforeEach(async () => {
    await addOneEService(eservice);
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
      handleEserviceDescriptorArchivedToProducer({
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

  it("emits one email per producer user with the expected subject when archivingSchedule is present on the descriptor", async () => {
    const messages = await handleEserviceDescriptorArchivedToProducer({
      eserviceV2Msg: toEServiceV2(eservice),
      descriptorId: archivingDescriptor.id,
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages).toHaveLength(users.length);
    expect(messages[0].email.subject).toMatch(expectedMessageSubject);
  });

  it("emits one email per producer user when archivingSchedule is absent on the descriptor (routine auto-archive)", async () => {
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
    await addOneTenant({ ...getMockTenant(producerId), name: "Producer T" });

    const messages = await handleEserviceDescriptorArchivedToProducer({
      eserviceV2Msg: toEServiceV2(routineEservice),
      descriptorId: routineDescriptor.id,
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages).toHaveLength(users.length);
    expect(messages[0].email.subject).toMatch(expectedMessageSubject);
  });
});
