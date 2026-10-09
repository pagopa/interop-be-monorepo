import { authRole } from "pagopa-interop-commons";
import {
  getMockContext,
  getMockDescriptorPublished,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  CorrelationId,
  EService,
  EServiceId,
  generateId,
  missingKafkaMessageDataError,
  TenantId,
  toEServiceV2,
} from "pagopa-interop-models";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleEserviceNameUpdatedByTemplateUpdateToInstantiator } from "../src/handlers/eservices/handleEserviceNameUpdatedByTemplateUpdateToInstantiator.js";
import {
  addOneEService,
  addOneTenant,
  getMockUser,
  readModelService,
  templateService,
} from "./utils.js";

describe("handleEserviceNameUpdatedByTemplateUpdateToInstantiator", async () => {
  const instantiatorId = generateId<TenantId>();
  const instantiatorTenant = getMockTenant(instantiatorId);
  const user = getMockUser(instantiatorId);

  const oldEserviceName = "eservice-template-807838540-0 - istanza";
  const newEserviceName = "eservice-template-807838540-1 - istanza";

  const descriptor = getMockDescriptorPublished();
  const instance: EService = {
    ...getMockEService(),
    id: generateId<EServiceId>(),
    producerId: instantiatorId,
    name: newEserviceName,
    descriptors: [descriptor],
  };

  const { logger } = getMockContext({});

  beforeEach(async () => {
    await addOneEService(instance);
    await addOneTenant(instantiatorTenant);
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([
        {
          userId: user.id,
          tenantId: user.tenantId,
          // Only consider ADMIN_ROLE since role restrictions are tested separately in getRecipientsForTenants.test.ts
          userRoles: [authRole.ADMIN_ROLE],
        },
      ]);
  });

  it("should throw missingKafkaMessageDataError when the eservice is undefined", async () => {
    await expect(() =>
      handleEserviceNameUpdatedByTemplateUpdateToInstantiator({
        payload: {
          data: {
            eservice: undefined,
            oldName: oldEserviceName,
          },
          event_version: 2,
          type: "EServiceNameUpdatedByTemplateUpdate",
        },
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      })
    ).rejects.toThrow(
      missingKafkaMessageDataError(
        "eservice",
        "EServiceNameUpdatedByTemplateUpdate"
      )
    );
  });

  it("should not generate a message if the instantiator user disabled this email notification", async () => {
    readModelService.getTenantUsersWithNotificationEnabled = vi
      .fn()
      .mockResolvedValue([]);

    const messages =
      await handleEserviceNameUpdatedByTemplateUpdateToInstantiator({
        payload: {
          data: {
            eservice: toEServiceV2(instance),
            oldName: oldEserviceName,
          },
          event_version: 2,
          type: "EServiceNameUpdatedByTemplateUpdate",
        },
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      });

    expect(messages.length).toEqual(0);
  });

  it("should generate one message per user of the instantiator", async () => {
    const messages =
      await handleEserviceNameUpdatedByTemplateUpdateToInstantiator({
        payload: {
          data: {
            eservice: toEServiceV2(instance),
            oldName: oldEserviceName,
          },
          event_version: 2,
          type: "EServiceNameUpdatedByTemplateUpdate",
        },
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      });

    expect(messages.length).toEqual(1);
    expect(messages[0].type === "User" && messages[0].userId).toEqual(user.id);
    expect(messages[0].tenantId).toEqual(instantiatorId);
  });

  it("should use the old and new e-service names carried by the event", async () => {
    const messages =
      await handleEserviceNameUpdatedByTemplateUpdateToInstantiator({
        payload: {
          data: {
            eservice: toEServiceV2(instance),
            oldName: oldEserviceName,
          },
          event_version: 2,
          type: "EServiceNameUpdatedByTemplateUpdate",
        },
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      });

    expect(messages[0].email.subject).toBe(
      `Il tuo e-service "${oldEserviceName}" è stato rinominato`
    );
    expect(messages[0].email.body).toContain(
      `Ti informiamo che il tuo e-service "${oldEserviceName}" è stato rinominato in`
    );
    expect(messages[0].email.body).toContain(newEserviceName);
  });

  it("should fall back to the e-service id when the event carries no old name", async () => {
    const messages =
      await handleEserviceNameUpdatedByTemplateUpdateToInstantiator({
        payload: {
          data: {
            eservice: toEServiceV2(instance),
            oldName: undefined,
          },
          event_version: 2,
          type: "EServiceNameUpdatedByTemplateUpdate",
        },
        logger,
        templateService,
        readModelService,
        correlationId: generateId<CorrelationId>(),
      });

    expect(messages[0].email.subject).toBe(
      `Il tuo e-service "${instance.id}" è stato rinominato`
    );
  });
});
