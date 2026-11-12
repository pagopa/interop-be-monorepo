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
  DescriptorId,
  descriptorState,
  EService,
  EServiceId,
  archivingScope,
  generateId,
  GracePeriodDays,
  gracePeriodDays,
  missingKafkaMessageDataError,
  TenantId,
  toEServiceV2,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleEserviceDescriptorActivatedToProducer } from "../src/handlers/eservices/handleEserviceDescriptorActivatedToProducer.js";
import {
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleEserviceDescriptorActivatedToProducer", () => {
  const producerId = generateId<TenantId>();
  const producerTenant = { ...getMockTenant(producerId), name: "Producer T" };

  const archivingDescriptorId = generateId<DescriptorId>();
  const archivingDescriptorEserviceScopeId = generateId<DescriptorId>();

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

  const getArchivingDescriptorEserviceScope = (
    gracePeriodDaysValue: GracePeriodDays
  ): Descriptor => ({
    ...getMockDescriptor(descriptorState.archiving),
    id: archivingDescriptorEserviceScopeId,
    version: "2",
    archivingSchedule: {
      archivableOn: new Date("2026-12-31T00:00:00.000Z"),
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
      scope: archivingScope.eservice,
      gracePeriodDays: gracePeriodDaysValue,
    },
  });

  const users = [
    getMockUser(producerTenant.id),
    getMockUser(producerTenant.id),
  ];

  const { logger } = getMockContext({});

  const expectedDescriptorMessageBody =
    /<p>\s*La versione <strong>\d+<\/strong> dell'e-service <strong>\s*[^<]+\s*<\/strong> è di nuovo attiva\. I fruitori potranno nuovamente scambiare dati con questa versione\.\s*La versione è in fase di archiviazione e sarà archiviata definitivamente il giorno <strong>\d{2}\/\d{2}\/\d{4}<\/strong>\.\s*<\/p>/;

  const expectedEserviceMessageBody =
    /<p>\s*La versione <strong>\d+<\/strong> dell'e-service <strong>\s*[^<]+\s*<\/strong> è di nuovo attiva\. I fruitori potranno nuovamente scambiare dati con questa versione\.\s*L'e-service è in fase di archiviazione e sarà archiviato definitivamente il giorno <strong>\d{2}\/\d{2}\/\d{4}<\/strong>\.\s*<\/p>/;

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
      handleEserviceDescriptorActivatedToProducer({
        eserviceV2Msg: undefined,
        descriptorId: archivingDescriptorId,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "EServiceDescriptorActivated")
    );
  });

  it.each([...gracePeriodDays])(
    "emits one email per producer user with the expected subject and body when archivingSchedule is present on the descriptor (scope descriptor, gracePeriodDays: %d)",
    async (gracePeriodDaysValue: GracePeriodDays) => {
      const archivingDescriptor = getArchivingDescriptor(gracePeriodDaysValue);
      const archivingDescriptorEserviceScope =
        getArchivingDescriptorEserviceScope(30);
      const eservice: EService = {
        ...getMockEService(),
        name: "Test E-service",
        producerId,
        descriptors: [archivingDescriptor, archivingDescriptorEserviceScope],
      };
      await addOneEService(eservice);

      const messages = await handleEserviceDescriptorActivatedToProducer({
        eserviceV2Msg: toEServiceV2(eservice),
        descriptorId: archivingDescriptor.id,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      });
      expect(messages).toHaveLength(users.length);
      expect(messages[0].email.subject).toBe(
        `Una versione di "${eservice.name}" è stata riattivata`
      );
      expect(messages[0].email.body).toMatch(expectedDescriptorMessageBody);
    }
  );

  it.each([...gracePeriodDays])(
    "emits one email per producer user with the expected subject and body when archivingSchedule is present on the descriptor (scope eservice, gracePeriodDays: %d)",
    async (gracePeriodDaysValue: GracePeriodDays) => {
      const archivingDescriptor = getArchivingDescriptor(30);
      const archivingDescriptorEserviceScope =
        getArchivingDescriptorEserviceScope(gracePeriodDaysValue);
      const eservice: EService = {
        ...getMockEService(),
        name: "Test E-service",
        producerId,
        descriptors: [archivingDescriptor, archivingDescriptorEserviceScope],
      };
      await addOneEService(eservice);

      const messages = await handleEserviceDescriptorActivatedToProducer({
        eserviceV2Msg: toEServiceV2(eservice),
        descriptorId: archivingDescriptorEserviceScope.id,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      });
      expect(messages).toHaveLength(users.length);
      expect(messages[0].email.subject).toBe(
        `Una versione di "${eservice.name}" è stata riattivata`
      );
      expect(messages[0].email.body).toMatch(expectedEserviceMessageBody);
    }
  );

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

    const messages = await handleEserviceDescriptorActivatedToProducer({
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
