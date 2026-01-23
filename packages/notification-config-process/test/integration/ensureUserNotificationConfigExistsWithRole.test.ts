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
  userRole,
  UserNotificationConfigRoleAddedV2,
} from "pagopa-interop-models";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  addOneUserNotificationConfig,
  notificationConfigService,
  readLastNotificationConfigEvent,
  readNotificationConfigEventByVersion,
} from "../integrationUtils.js";

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
    purposeQuotaAdjustmentRequestToProducer: false,
    purposeOverQuotaStateToConsumer: false,
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
    purposeQuotaAdjustmentRequestToProducer: false,
    purposeOverQuotaStateToConsumer: false,
  };
  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  it("should write on event-store for the creation of a user's notification configuration", async () => {
    const serviceReturnValue =
      await notificationConfigService.ensureUserNotificationConfigExistsWithRoles(
        userId,
        tenantId,
        [userRole.ADMIN_ROLE],
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
      userRoles: [userRole.ADMIN_ROLE],
      inAppNotificationPreference: false,
      emailNotificationPreference: false,
      emailDigestPreference: false,
      inAppConfig: defaultInAppConfig,
      emailConfig: defaultEmailConfig,
      createdAt: new Date(),
    };
    expect(serviceReturnValue).toEqual(expectedUserNotificationConfig);
    expect(writtenPayload.userNotificationConfig).toEqual(
      toUserNotificationConfigV2(expectedUserNotificationConfig)
    );
  });

  it("should return existing config if a notification config already exists for that user with the same role, without writing on event-store", async () => {
    const userNotificationConfig: UserNotificationConfig = {
      ...getMockUserNotificationConfig(),
      userId,
      tenantId,
      userRoles: [userRole.ADMIN_ROLE],
    };
    await addOneUserNotificationConfig(userNotificationConfig);
    const serviceReturnValue =
      await notificationConfigService.ensureUserNotificationConfigExistsWithRoles(
        userId,
        tenantId,
        [userRole.ADMIN_ROLE],
        getMockContextInternal({})
      );
    expect(serviceReturnValue).toEqual(userNotificationConfig);
    const writtenEvent = await readLastNotificationConfigEvent(
      serviceReturnValue.id
    );
    // No new event should be written
    expect(writtenEvent.stream_id).toBe(serviceReturnValue.id);
    expect(writtenEvent.version).toBe("0");
    expect(writtenEvent.type).toBe("UserNotificationConfigCreated");
    expect(writtenEvent.event_version).toBe(2);
  });

  it("should write on event-store for the added role if a notification config already exists for that user but without that role", async () => {
    const userNotificationConfig: UserNotificationConfig = {
      ...getMockUserNotificationConfig(),
      userId,
      tenantId,
      userRoles: [userRole.SECURITY_ROLE],
    };
    await addOneUserNotificationConfig(userNotificationConfig);
    const serviceReturnValue =
      await notificationConfigService.ensureUserNotificationConfigExistsWithRoles(
        userId,
        tenantId,
        [userRole.API_ROLE],
        getMockContextInternal({})
      );
    const updatedUserNotificationConfig: UserNotificationConfig = {
      ...userNotificationConfig,
      userRoles: [userRole.SECURITY_ROLE, userRole.API_ROLE],
      updatedAt: new Date(),
    };
    expect(serviceReturnValue).toEqual(updatedUserNotificationConfig);
    const writtenEvent = await readLastNotificationConfigEvent(
      serviceReturnValue.id
    );
    expect(writtenEvent.stream_id).toBe(userNotificationConfig.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("UserNotificationConfigRoleAdded");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: UserNotificationConfigRoleAddedV2,
      payload: writtenEvent.data,
    });
    expect(writtenPayload.userNotificationConfig).toEqual(
      toUserNotificationConfigV2(updatedUserNotificationConfig)
    );
  });

  it("should create notification config with multiple roles at once", async () => {
    const newUserId: UserId = generateId();
    const newTenantId: TenantId = generateId();
    const serviceReturnValue =
      await notificationConfigService.ensureUserNotificationConfigExistsWithRoles(
        newUserId,
        newTenantId,
        [userRole.ADMIN_ROLE, userRole.API_ROLE],
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
      userId: newUserId,
      tenantId: newTenantId,
      userRoles: [userRole.ADMIN_ROLE, userRole.API_ROLE],
      inAppNotificationPreference: false,
      emailNotificationPreference: false,
      emailDigestPreference: false,
      inAppConfig: defaultInAppConfig,
      emailConfig: defaultEmailConfig,
      createdAt: new Date(),
    };
    expect(serviceReturnValue).toEqual(expectedUserNotificationConfig);
    expect(writtenPayload.userNotificationConfig).toEqual(
      toUserNotificationConfigV2(expectedUserNotificationConfig)
    );
  });

  it("should write two events when adding two missing roles to an existing config", async () => {
    const newUserId: UserId = generateId();
    const newTenantId: TenantId = generateId();
    const userNotificationConfig: UserNotificationConfig = {
      ...getMockUserNotificationConfig(),
      userId: newUserId,
      tenantId: newTenantId,
      userRoles: [userRole.SECURITY_ROLE],
    };
    await addOneUserNotificationConfig(userNotificationConfig);

    const serviceReturnValue =
      await notificationConfigService.ensureUserNotificationConfigExistsWithRoles(
        newUserId,
        newTenantId,
        [userRole.ADMIN_ROLE, userRole.API_ROLE],
        getMockContextInternal({})
      );

    const expectedFinalUserNotificationConfig: UserNotificationConfig = {
      ...userNotificationConfig,
      userRoles: [userRole.SECURITY_ROLE, userRole.ADMIN_ROLE, userRole.API_ROLE],
      updatedAt: new Date(),
    };
    expect(serviceReturnValue).toEqual(expectedFinalUserNotificationConfig);

    // Read the last event (version 2) - should be the second role addition
    const lastEvent = await readLastNotificationConfigEvent(
      serviceReturnValue.id
    );
    expect(lastEvent.stream_id).toBe(userNotificationConfig.id);
    expect(lastEvent.version).toBe("2");
    expect(lastEvent.type).toBe("UserNotificationConfigRoleAdded");
    expect(lastEvent.event_version).toBe(2);

    const lastEventPayload = decodeProtobufPayload({
      messageType: UserNotificationConfigRoleAddedV2,
      payload: lastEvent.data,
    });
    expect(lastEventPayload.userNotificationConfig).toEqual(
      toUserNotificationConfigV2(expectedFinalUserNotificationConfig)
    );

    // Read the previous event (version 1) - should be the first role addition
    const firstRoleEvent = await readNotificationConfigEventByVersion(
      serviceReturnValue.id,
      1
    );
    expect(firstRoleEvent.stream_id).toBe(userNotificationConfig.id);
    expect(firstRoleEvent.version).toBe("1");
    expect(firstRoleEvent.type).toBe("UserNotificationConfigRoleAdded");
    expect(firstRoleEvent.event_version).toBe(2);

    const firstRoleEventPayload = decodeProtobufPayload({
      messageType: UserNotificationConfigRoleAddedV2,
      payload: firstRoleEvent.data,
    });
    const expectedAfterFirstRoleConfig: UserNotificationConfig = {
      ...userNotificationConfig,
      userRoles: [userRole.SECURITY_ROLE, userRole.ADMIN_ROLE],
      updatedAt: new Date(),
    };
    expect(firstRoleEventPayload.userNotificationConfig).toEqual(
      toUserNotificationConfigV2(expectedAfterFirstRoleConfig)
    );
  });
});
