/* eslint-disable functional/immutable-data */
import {
  getMockContext,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import { authRole } from "pagopa-interop-commons";
import {
  CorrelationId,
  Descriptor,
  descriptorState,
  EService,
  generateId,
  missingKafkaMessageDataError,
  TenantId,
  toEServiceV2,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleEserviceArchivingCanceledToProducer } from "../src/handlers/eservices/handleEserviceArchivingCanceledToProducer.js";
import {
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleEserviceArchivingCanceledToProducer", () => {
  const producerId = generateId<TenantId>();
  const producerTenant = { ...getMockTenant(producerId), name: "Producer T" };

  const publishedDescriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.published),
  };
  const eservice: EService = {
    ...getMockEService(),
    name: "Test E-service",
    producerId,
    descriptors: [publishedDescriptor],
  };
  const users = [getMockUser(producerTenant.id)];

  const { logger } = getMockContext({});

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
      handleEserviceArchivingCanceledToProducer({
        eserviceV2Msg: undefined,
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "EServiceArchivingCanceled")
    );
  });

  it("emits one email per producer user with the expected subject", async () => {
    const messages = await handleEserviceArchivingCanceledToProducer({
      eserviceV2Msg: toEServiceV2(eservice),
      logger,
      templateService,
      readModelService,
      correlationId: generateId<CorrelationId>(),
    });
    expect(messages).toHaveLength(users.length);
    expect(messages[0].email.subject).toContain(
      "Un tuo e-service non è più in fase di archiviazione"
    );
  });
});
