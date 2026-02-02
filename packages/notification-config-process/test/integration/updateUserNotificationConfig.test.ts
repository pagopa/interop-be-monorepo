import { match } from "ts-pattern";
import {
  getMockContext,
  getMockAuthData,
  decodeProtobufPayload,
  getMockNotificationConfig,
  getMockUserNotificationConfig,
} from "pagopa-interop-commons-test";
import { authRole, notificationAdmittedRoles } from "pagopa-interop-commons";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import {
  generateId,
  TenantId,
  UserId,
  UserNotificationConfig,
  UserNotificationConfigUpdatedV2,
  toUserNotificationConfigV2,
  NotificationType,
  UserRole,
  userRole,
} from "pagopa-interop-models";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  addOneUserNotificationConfig,
  notificationConfigService,
  readLastNotificationConfigEvent,
} from "../integrationUtils.js";
import {
  notificationConfigNotAllowedForUserRoles,
  userNotificationConfigNotFound,
} from "../../src/model/domain/errors.js";

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
      emailNotificationPreference: true,
      emailDigestPreference: false,
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
        purposeQuotaAdjustmentRequestToProducer:
          !userNotificationConfig.inAppConfig
            .purposeQuotaAdjustmentRequestToProducer,
        purposeOverQuotaStateToConsumer:
          !userNotificationConfig.inAppConfig.purposeOverQuotaStateToConsumer,
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

  it.each<[UserRole[], NotificationType, "inApp" | "email"]>([
    [
      [authRole.API_ROLE],
      "certifiedVerifiedAttributeAssignedRevokedToAssignee",
      "inApp",
    ],
    [[authRole.SECURITY_ROLE], "templateStatusChangedToProducer", "email"],
    [
      [authRole.API_ROLE, authRole.SECURITY_ROLE],
      "delegationApprovedRejectedToDelegator",
      "inApp",
    ],
  ])(
    "should throw notificationConfigNotAllowedForUserRoles if a user with %s roles enables the not allowed notification type %s for %s notifications",
    async (userRoles, notificationType, notificationChannel) => {
      // For safety in case the admitted roles change in the future
      userRoles.forEach((role) =>
        expect(notificationAdmittedRoles[notificationType][role]).toBe(false)
      );
      const seed = match(notificationChannel)
        .with("inApp", () => ({
          ...userNotificationConfigSeed,
          inAppConfig: {
            ...userNotificationConfigSeed.inAppConfig,
            [notificationType]: true,
          },
        }))
        .with("email", () => ({
          ...userNotificationConfigSeed,
          emailConfig: {
            ...userNotificationConfigSeed.emailConfig,
            [notificationType]: true,
          },
        }))
        .exhaustive();
      expect(
        notificationConfigService.updateUserNotificationConfig(
          seed,
          getMockContext({
            authData: getMockAuthData(tenantId, userId, userRoles),
          })
        )
      ).rejects.toThrowError(
        notificationConfigNotAllowedForUserRoles(userId, tenantId)
      );
    }
  );
});
