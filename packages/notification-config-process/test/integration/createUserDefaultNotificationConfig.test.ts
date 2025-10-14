import {
  decodeProtobufPayload,
  getMockUserNotificationConfig,
  getMockContextInternal,
} from "pagopa-interop-commons-test";
import {
  generateId,
  UserId,
  UserNotificationConfig,
  UserNotificationConfigCreatedV2,
  toUserNotificationConfigV2,
  TenantId,
  NotificationConfig,
  emailNotificationPreference,
} from "pagopa-interop-models";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  addOneUserNotificationConfig,
  notificationConfigService,
  readLastNotificationConfigEvent,
} from "../integrationUtils.js";
import { userNotificationConfigAlreadyExists } from "../../src/model/domain/errors.js";

describe("createUserNotificationConfig", () => {
  const userId: UserId = generateId();
  const tenantId: TenantId = generateId();

  const defaultInAppConfig: NotificationConfig = {
    agreementSuspendedUnsuspendedToProducer: false,
    agreementManagementToProducer: false,
    clientAddedRemovedToProducer: false,
    purposeStatusChangedToProducer: false,
    templateStatusChangedToProducer: false,
    agreementSuspendedUnsuspendedToConsumer: false,
    eserviceStateChangedToConsumer: false,
    agreementActivatedRejectedToConsumer: false,
    purposeActivatedRejectedToConsumer: false,
    purposeSuspendedUnsuspendedToConsumer: false,
    newEserviceTemplateVersionToInstantiator: false,
    eserviceTemplateNameChangedToInstantiator: false,
    eserviceTemplateStatusChangedToInstantiator: false,
    delegationApprovedRejectedToDelegator: false,
    eserviceNewVersionSubmittedToDelegator: false,
    eserviceNewVersionApprovedRejectedToDelegate: false,
    delegationSubmittedRevokedToDelegate: false,
    certifiedVerifiedAttributeAssignedRevokedToAssignee: false,
    clientKeyAddedDeletedToClientUsers: false,
    producerKeychainKeyAddedDeletedToClientUsers: false,
  };
  const defaultEmailConfig: NotificationConfig = {
    agreementSuspendedUnsuspendedToProducer: false,
    agreementManagementToProducer: false,
    clientAddedRemovedToProducer: false,
    purposeStatusChangedToProducer: false,
    templateStatusChangedToProducer: false,
    agreementSuspendedUnsuspendedToConsumer: false,
    eserviceStateChangedToConsumer: false,
    agreementActivatedRejectedToConsumer: false,
    purposeActivatedRejectedToConsumer: false,
    purposeSuspendedUnsuspendedToConsumer: false,
    newEserviceTemplateVersionToInstantiator: false,
    eserviceTemplateNameChangedToInstantiator: false,
    eserviceTemplateStatusChangedToInstantiator: false,
    delegationApprovedRejectedToDelegator: false,
    eserviceNewVersionSubmittedToDelegator: false,
    eserviceNewVersionApprovedRejectedToDelegate: false,
    delegationSubmittedRevokedToDelegate: false,
    certifiedVerifiedAttributeAssignedRevokedToAssignee: false,
    clientKeyAddedDeletedToClientUsers: false,
    producerKeychainKeyAddedDeletedToClientUsers: false,
  };
  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  it("should write on event-store for the creation of a user's notification configuration", async () => {
    const serviceReturnValue =
      await notificationConfigService.createUserDefaultNotificationConfig(
        userId,
        tenantId,
        getMockContextInternal({})
      );
    const writtenEvent = await readLastNotificationConfigEvent(
      serviceReturnValue.id
    );
    expect(writtenEvent.stream_id).toBe(serviceReturnValue.id);
    expect(writtenEvent.version).toBe("0");
    expect(writtenEvent.type).toBe("UserNotificationConfigCreated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: UserNotificationConfigCreatedV2,
      payload: writtenEvent.data,
    });
    const expectedUserNotificationConfig: UserNotificationConfig = {
      id: serviceReturnValue.id,
      userId,
      tenantId,
      inAppNotificationPreference: false,
      emailNotificationPreference: emailNotificationPreference.disabled,
      inAppConfig: defaultInAppConfig,
      emailConfig: defaultEmailConfig,
      createdAt: new Date(),
    };
    expect(serviceReturnValue).toEqual(expectedUserNotificationConfig);
    expect(writtenPayload.userNotificationConfig).toEqual(
      toUserNotificationConfigV2(expectedUserNotificationConfig)
    );
  });

  it("should throw userNotificationConfigAlreadyExists if a notification config already exists for that user", async () => {
    const userNotificationConfig: UserNotificationConfig = {
      ...getMockUserNotificationConfig(),
      userId,
      tenantId,
    };
    await addOneUserNotificationConfig(userNotificationConfig);
    expect(
      notificationConfigService.createUserDefaultNotificationConfig(
        userId,
        tenantId,
        getMockContextInternal({})
      )
    ).rejects.toThrowError(
      userNotificationConfigAlreadyExists(userId, tenantId)
    );
  });
});
