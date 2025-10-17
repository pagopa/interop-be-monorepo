import {
  getMockContext,
  getMockAuthData,
  decodeProtobufPayload,
  getMockNotificationConfig,
  getMockUserNotificationConfig,
} from "pagopa-interop-commons-test";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import {
  generateId,
  TenantId,
  UserId,
  UserNotificationConfig,
  UserNotificationConfigUpdatedV2,
  toUserNotificationConfigV2,
  emailNotificationPreference,
  userRole,
} from "pagopa-interop-models";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  addOneUserNotificationConfig,
  notificationConfigService,
  readLastNotificationConfigEvent,
} from "../integrationUtils.js";
import { userNotificationConfigNotFound } from "../../src/model/domain/errors.js";

describe("updateUserNotificationConfig", () => {
  const userId: UserId = generateId();
  const tenantId: TenantId = generateId();

  const userNotificationConfig: UserNotificationConfig = {
    ...getMockUserNotificationConfig(),
    userId,
    tenantId,
    userRoles: [userRole.ADMIN_ROLE],
  };
  const userNotificationConfigSeed: notificationConfigApi.UserNotificationConfigUpdateSeed =
    {
      inAppNotificationPreference: true,
      emailNotificationPreference: "ENABLED",
      inAppConfig: {
        agreementSuspendedUnsuspendedToProducer:
          !userNotificationConfig.inAppConfig
            .agreementSuspendedUnsuspendedToProducer,
        agreementManagementToProducer:
          !userNotificationConfig.inAppConfig.agreementManagementToProducer,
        clientAddedRemovedToProducer:
          !userNotificationConfig.inAppConfig.clientAddedRemovedToProducer,
        purposeStatusChangedToProducer:
          !userNotificationConfig.inAppConfig.purposeStatusChangedToProducer,
        templateStatusChangedToProducer:
          !userNotificationConfig.inAppConfig.templateStatusChangedToProducer,
        agreementSuspendedUnsuspendedToConsumer:
          !userNotificationConfig.inAppConfig
            .agreementSuspendedUnsuspendedToConsumer,
        eserviceStateChangedToConsumer:
          !userNotificationConfig.inAppConfig.eserviceStateChangedToConsumer,
        agreementActivatedRejectedToConsumer:
          !userNotificationConfig.inAppConfig
            .agreementActivatedRejectedToConsumer,
        purposeActivatedRejectedToConsumer:
          !userNotificationConfig.inAppConfig
            .purposeActivatedRejectedToConsumer,
        purposeSuspendedUnsuspendedToConsumer:
          !userNotificationConfig.inAppConfig
            .purposeSuspendedUnsuspendedToConsumer,
        newEserviceTemplateVersionToInstantiator:
          !userNotificationConfig.inAppConfig
            .newEserviceTemplateVersionToInstantiator,
        eserviceTemplateNameChangedToInstantiator:
          !userNotificationConfig.inAppConfig
            .eserviceTemplateNameChangedToInstantiator,
        eserviceTemplateStatusChangedToInstantiator:
          !userNotificationConfig.inAppConfig
            .eserviceTemplateStatusChangedToInstantiator,
        delegationApprovedRejectedToDelegator:
          !userNotificationConfig.inAppConfig
            .delegationApprovedRejectedToDelegator,
        eserviceNewVersionSubmittedToDelegator:
          !userNotificationConfig.inAppConfig
            .eserviceNewVersionSubmittedToDelegator,
        eserviceNewVersionApprovedRejectedToDelegate:
          !userNotificationConfig.inAppConfig
            .eserviceNewVersionApprovedRejectedToDelegate,
        delegationSubmittedRevokedToDelegate:
          !userNotificationConfig.inAppConfig
            .delegationSubmittedRevokedToDelegate,
        certifiedVerifiedAttributeAssignedRevokedToAssignee:
          !userNotificationConfig.inAppConfig
            .certifiedVerifiedAttributeAssignedRevokedToAssignee,
        clientKeyAddedDeletedToClientUsers:
          !userNotificationConfig.inAppConfig
            .clientKeyAddedDeletedToClientUsers,
        producerKeychainKeyAddedDeletedToClientUsers:
          !userNotificationConfig.inAppConfig
            .producerKeychainKeyAddedDeletedToClientUsers,
      },
      emailConfig: getMockNotificationConfig(),
    };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
    // Extra config to check that the correct one is updated
    await addOneUserNotificationConfig(getMockUserNotificationConfig());
  });

  it("should write on event-store for the update of a user's existing notification configuration", async () => {
    await addOneUserNotificationConfig(userNotificationConfig);
    const serviceReturnValue =
      await notificationConfigService.updateUserNotificationConfig(
        userNotificationConfigSeed,
        getMockContext({
          authData: getMockAuthData(tenantId, userId),
        })
      );
    const writtenEvent = await readLastNotificationConfigEvent(
      serviceReturnValue.id
    );
    expect(writtenEvent.stream_id).toBe(serviceReturnValue.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("UserNotificationConfigUpdated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: UserNotificationConfigUpdatedV2,
      payload: writtenEvent.data,
    });
    const expectedUserNotificationConfig: UserNotificationConfig = {
      id: serviceReturnValue.id,
      userId,
      tenantId,
      userRoles: [userRole.ADMIN_ROLE],
      ...userNotificationConfigSeed,
      emailNotificationPreference: emailNotificationPreference.enabled,
      createdAt: userNotificationConfig.createdAt,
      updatedAt: new Date(),
    };
    expect(serviceReturnValue).toEqual(expectedUserNotificationConfig);
    expect(writtenPayload.userNotificationConfig).toEqual(
      toUserNotificationConfigV2(expectedUserNotificationConfig)
    );
  });

  it.each<[string, UserId, TenantId]>([
    ["non-existent tenant id", userId, generateId<TenantId>()],
    ["non-existent user id", generateId<UserId>(), tenantId],
    [
      "non-existent user and tenant id's",
      generateId<UserId>(),
      generateId<TenantId>(),
    ],
  ])(
    "should throw userNotificationConfigNotFound in case of %s",
    async (_, userId, tenantId) => {
      expect(
        notificationConfigService.updateUserNotificationConfig(
          userNotificationConfigSeed,
          getMockContext({
            authData: getMockAuthData(tenantId, userId),
          })
        )
      ).rejects.toThrowError(userNotificationConfigNotFound(userId, tenantId));
    }
  );
});
