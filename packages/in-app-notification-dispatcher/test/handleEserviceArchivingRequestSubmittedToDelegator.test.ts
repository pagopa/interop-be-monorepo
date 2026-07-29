import {
  getMockContext,
  getMockDelegation,
  getMockDescriptor,
  getMockEService,
  getMockTenant,
} from "pagopa-interop-commons-test";
import {
  Descriptor,
  DescriptorId,
  EService,
  EServiceArchivingRequestedByDelegateV2,
  EServiceDescriptorArchivingRequestedByDelegateV2,
  EServiceEventV2,
  UserId,
  delegationKind,
  delegationState,
  descriptorState,
  generateId,
  missingKafkaMessageDataError,
  toEServiceV2,
} from "pagopa-interop-models";
import { getNotificationRecipients } from "pagopa-interop-notification-commons";
import { beforeEach, describe, expect, it, Mock } from "vitest";

import { handleEserviceArchivingRequestSubmittedToDelegator } from "../src/handlers/eservices/handleEserviceArchivingRequestSubmittedToDelegator.js";
import {
  addOneDelegation,
  addOneEService,
  addOneTenant,
  readModelService,
} from "./utils.js";

describe("handleEserviceArchivingRequestSubmittedToDelegator", () => {
  const delegator = getMockTenant();
  const delegate = getMockTenant();
  const userId = generateId<UserId>();
  const { logger } = getMockContext({});
  const descriptorId = generateId<DescriptorId>();

  const descriptor: Descriptor = {
    ...getMockDescriptor(descriptorState.archiving),
    id: descriptorId,
  };

  const eservice: EService = {
    ...getMockEService(),
    producerId: delegator.id,
    descriptors: [descriptor],
  };

  const delegation = getMockDelegation({
    kind: delegationKind.delegatedProducer,
    delegatorId: delegator.id,
    delegateId: delegate.id,
    eserviceId: eservice.id,
    state: delegationState.active,
  });

  const mockGetNotificationRecipients = getNotificationRecipients as Mock;

  beforeEach(async () => {
    mockGetNotificationRecipients.mockReset();
    mockGetNotificationRecipients.mockResolvedValue([
      { userId, tenantId: delegator.id },
    ]);

    await addOneTenant(delegator);
    await addOneTenant(delegate);
    await addOneEService(eservice);
    await addOneDelegation(delegation);
  });

  it("throws missingKafkaMessageDataError when eservice is undefined", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceArchivingRequestedByDelegate",
      data: {
        eservice: undefined,
      } satisfies EServiceArchivingRequestedByDelegateV2,
    };

    await expect(() =>
      handleEserviceArchivingRequestSubmittedToDelegator(
        msg,
        logger,
        readModelService
      )
    ).rejects.toThrow(
      missingKafkaMessageDataError("eservice", "EServiceArchivingRequestedByDelegate")
    );
  });

  it("emits notification to delegator for requested archiving request", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceArchivingRequestedByDelegate",
      data: {
        eservice: toEServiceV2(eservice),
      } satisfies EServiceArchivingRequestedByDelegateV2,
    };

    const notifications =
      await handleEserviceArchivingRequestSubmittedToDelegator(
        msg,
        logger,
        readModelService
      );

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toEqual({
      userId,
      tenantId: delegator.id,
      body: `${delegate.name} ha richiesto l'archiviazione dell'e-service ${eservice.name}. Puoi confermare o rifiutare la richiesta.`,
      notificationType: "eserviceArchivingRequestSubmittedToDelegator",
      entityId: delegation.id,
    });
  });

  it("emits notification to delegator for descriptor requested archiving request", async () => {
    const msg: EServiceEventV2 = {
      event_version: 2,
      type: "EServiceDescriptorArchivingRequestedByDelegate",
      data: {
        descriptorId,
        eservice: toEServiceV2(eservice),
      } satisfies EServiceDescriptorArchivingRequestedByDelegateV2,
    };

    const notifications =
      await handleEserviceArchivingRequestSubmittedToDelegator(
        msg,
        logger,
        readModelService
      );

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toEqual({
      userId,
      tenantId: delegator.id,
      body: `${delegate.name} ha richiesto l'archiviazione della versione ${descriptor.version} dell'e-service ${eservice.name}. Puoi confermare o rifiutare la richiesta.`,
      notificationType: "eserviceArchivingRequestSubmittedToDelegator",
      entityId: delegation.id,
    });
  });
});
