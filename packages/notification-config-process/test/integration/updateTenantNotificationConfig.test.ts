import {
  getMockContext,
  getMockAuthData,
  decodeProtobufPayload,
  getMockTenantNotificationConfig,
} from "pagopa-interop-commons-test";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import {
  generateId,
  TenantId,
  TenantNotificationConfig,
  TenantNotificationConfigUpdatedV2,
  toTenantNotificationConfigV2,
} from "pagopa-interop-models";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  addOneTenantNotificationConfig,
  notificationConfigService,
  readLastNotificationConfigEvent,
} from "../integrationUtils.js";
import { tenantNotificationConfigNotFound } from "../../src/model/domain/errors.js";

describe("updateTenantNotificationConfig", () => {
  const tenantId: TenantId = generateId();

  const tenantNotificationConfig: TenantNotificationConfig = {
    ...getMockTenantNotificationConfig(),
    tenantId,
  };
  const notificationConfigSeed: notificationConfigApi.TenantNotificationConfigUpdateSeed =
    {
      agreementSuspendedUnsuspendedToProducer:
        !tenantNotificationConfig.config
          .agreementSuspendedUnsuspendedToProducer,
      agreementManagementToProducer:
        !tenantNotificationConfig.config.agreementManagementToProducer,
      clientAddedRemovedToProducer:
        !tenantNotificationConfig.config.clientAddedRemovedToProducer,
      purposeStatusChangedToProducer:
        !tenantNotificationConfig.config.purposeStatusChangedToProducer,
      templateStatusChangedToProducer:
        !tenantNotificationConfig.config.templateStatusChangedToProducer,
      agreementSuspendedUnsuspendedToConsumer:
        !tenantNotificationConfig.config
          .agreementSuspendedUnsuspendedToConsumer,
      eserviceStateChangedToConsumer:
        !tenantNotificationConfig.config.eserviceStateChangedToConsumer,
      agreementActivatedRejectedToConsumer:
        !tenantNotificationConfig.config.agreementActivatedRejectedToConsumer,
      purposeActivatedRejectedToConsumer:
        !tenantNotificationConfig.config.purposeActivatedRejectedToConsumer,
      purposeSuspendedUnsuspendedToConsumer:
        !tenantNotificationConfig.config.purposeSuspendedUnsuspendedToConsumer,
      newEserviceTemplateVersionToInstantiator:
        !tenantNotificationConfig.config
          .newEserviceTemplateVersionToInstantiator,
      eserviceTemplateNameChangedToInstantiator:
        !tenantNotificationConfig.config
          .eserviceTemplateNameChangedToInstantiator,
      eserviceTemplateStatusChangedToInstantiator:
        !tenantNotificationConfig.config
          .eserviceTemplateStatusChangedToInstantiator,
      delegationApprovedRejectedToDelegator:
        !tenantNotificationConfig.config.delegationApprovedRejectedToDelegator,
      eserviceNewVersionSubmittedToDelegator:
        !tenantNotificationConfig.config.eserviceNewVersionSubmittedToDelegator,
      eserviceNewVersionApprovedRejectedToDelegate:
        !tenantNotificationConfig.config
          .eserviceNewVersionApprovedRejectedToDelegate,
      delegationSubmittedRevokedToDelegate:
        !tenantNotificationConfig.config.delegationSubmittedRevokedToDelegate,
      certifiedVerifiedAttributeAssignedRevokedToAssignee:
        !tenantNotificationConfig.config
          .certifiedVerifiedAttributeAssignedRevokedToAssignee,
      clientKeyAddedDeletedToClientUsers:
        !tenantNotificationConfig.config.clientKeyAddedDeletedToClientUsers,
    };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
    // Extra config to check that the correct one is updated
    await addOneTenantNotificationConfig(getMockTenantNotificationConfig());
  });

  it("should write on event-store for the update of a tenant's existing notification configuration", async () => {
    await addOneTenantNotificationConfig(tenantNotificationConfig);
    const serviceReturnValue =
      await notificationConfigService.updateTenantNotificationConfig(
        notificationConfigSeed,
        getMockContext({
          authData: getMockAuthData(tenantId),
        })
      );
    const writtenEvent = await readLastNotificationConfigEvent(
      serviceReturnValue.id
    );
    expect(writtenEvent.stream_id).toBe(serviceReturnValue.id);
    expect(writtenEvent.version).toBe("1");
    expect(writtenEvent.type).toBe("TenantNotificationConfigUpdated");
    expect(writtenEvent.event_version).toBe(2);
    const writtenPayload = decodeProtobufPayload({
      messageType: TenantNotificationConfigUpdatedV2,
      payload: writtenEvent.data,
    });
    const expectedTenantNotificationConfig = {
      id: serviceReturnValue.id,
      tenantId,
      config: notificationConfigSeed,
      createdAt: tenantNotificationConfig.createdAt,
      updatedAt: new Date(),
    };
    expect(serviceReturnValue).toEqual(expectedTenantNotificationConfig);
    expect(writtenPayload.tenantNotificationConfig).toEqual(
      toTenantNotificationConfigV2(expectedTenantNotificationConfig)
    );
  });

  it("should throw tenantNotificationConfigNotFound if no notification config exists for the tenant", async () => {
    const notExistingTenantId: TenantId = generateId();
    expect(
      notificationConfigService.updateTenantNotificationConfig(
        notificationConfigSeed,
        getMockContext({
          authData: getMockAuthData(notExistingTenantId),
        })
      )
    ).rejects.toThrowError(
      tenantNotificationConfigNotFound(notExistingTenantId)
    );
  });
});
