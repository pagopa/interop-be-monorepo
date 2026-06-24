/* eslint-disable functional/immutable-data */
import {
  getMockContext,
  getMockDescriptor,
  getMockDescriptorPublished,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
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
import { handleEserviceDescriptorSuspendedToProducer } from "../src/handlers/eservices/handleEserviceDescriptorSuspendedToProducer.js";
import {
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleEserviceDescriptorSuspendedToProducer", () => {
  const producerId = generateId<TenantId>();
  const producerTenant = { ...getMockTenant(producerId), name: "Producer T" };

  const archivingDescriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.archivingSuspended),
    archivingSchedule: {
      archivableOn: new Date("2026-12-31T00:00:00.000Z"),
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
      scope: archivingScope.descriptor,
    },
  };

  const archivingDescriptorEserviceScope: Descriptor = {
    ...getMockDescriptor(descriptorState.archiving),
    version: "2",
    archivingSchedule: {
      archivableOn: new Date("2026-12-31T00:00:00.000Z"),
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
      scope: archivingScope.eservice,
    },
  };

  const eservice: EService = {
    ...getMockEService(),
    name: "Test E-service",
    producerId,
    descriptors: [archivingDescriptor, archivingDescriptorEserviceScope],
  };

  const users = [
    getMockUser(producerTenant.id),
    getMockUser(producerTenant.id),
  ];

  const { logger } = getMockContext({});

  const expectedDescriptorMessageBody =
    /<p>La versione \d+ dell'e-service "[^"]+" è al momento sospesa\. I fruitori non potranno più scambiare dati con questa versione\.<\/p>[\s\n]*<p>La versione è in fase di archiviazione e sarà archiviata definitivamente il giorno \d{2}\/\d{2}\/\d{4}\./;

  const expectedEserviceMessageBody =
    /<p>La versione \d+ dell'e-service "[^"]+" è al momento sospesa\. I fruitori non potranno più scambiare dati con questa versione\.<\/p>[\s\n]*<p>L'e-service è in fase di archiviazione e sarà archiviato definitivamente il giorno \d{2}\/\d{2}\/\d{4}\./;

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
      handleEserviceDescriptorSuspendedToProducer({
        eserviceV2Msg: undefined,
        descriptorId: archivingDescriptor.id,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "EServiceDescriptorSuspended")
    );
  });

  it("emits one email per producer user with the expected subject and body when archivingSchedule is present on the descriptor (scope descriptor)", async () => {
    const messages = await handleEserviceDescriptorSuspendedToProducer({
      eserviceV2Msg: toEServiceV2(eservice),
      descriptorId: archivingDescriptor.id,
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages).toHaveLength(users.length);
    expect(messages[0].email.subject).toBe(
      `Una versione di "${eservice.name}" è stata sospesa`
    );
    expect(messages[0].email.body).toMatch(expectedDescriptorMessageBody);
  });

  it("emits one email per producer user with the expected subject and body when archivingSchedule is present on the descriptor (scope eservice)", async () => {
    const messages = await handleEserviceDescriptorSuspendedToProducer({
      eserviceV2Msg: toEServiceV2(eservice),
      descriptorId: archivingDescriptorEserviceScope.id,
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages).toHaveLength(users.length);
    expect(messages[0].email.subject).toBe(
      `Una versione di "${eservice.name}" è stata sospesa`
    );
    expect(messages[0].email.body).toMatch(expectedEserviceMessageBody);
  });

  it("emits no email per producer user when archivingSchedule is absent on the descriptor (routine auto-archive)", async () => {
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

    const messages = await handleEserviceDescriptorSuspendedToProducer({
      eserviceV2Msg: toEServiceV2(routineEservice),
      descriptorId: routineDescriptor.id,
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages).toHaveLength(0);
  });
});
