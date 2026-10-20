import { HtmlTemplateService, Logger } from "pagopa-interop-commons";
import {
  Attribute,
  AttributeId,
  CorrelationId,
  Delegation,
  EService,
  EServiceId,
  EventEnvelope,
  NotificationType,
  Purpose,
  PurposeId,
  Tenant,
  TenantId,
  TenantNotificationConfig,
  UserId,
  UserRole,
} from "pagopa-interop-models";
import { z } from "zod";

export type Channel = "inApp" | "email";

export type NotificationReadModelService = {
  notificationTypeBlocklist?: NotificationType[];
  getTenantById: (tenantId: TenantId) => Promise<Tenant | undefined>;
  getEServiceById: (id: EServiceId) => Promise<EService | undefined>;
  getPurposeById: (purposeId: PurposeId) => Promise<Purpose | undefined>;
  getAttributeById: (
    attributeId: AttributeId
  ) => Promise<Attribute | undefined>;
  getTenantByCertifierId: (certifierId: string) => Promise<Tenant | undefined>;
  getActiveProducerDelegation: (
    eserviceId: EServiceId,
    producerId: TenantId
  ) => Promise<Delegation | undefined>;
  getTenantUsersWithNotificationEnabled: (
    tenantIds: TenantId[],
    notificationType: NotificationType,
    channel: Channel
  ) => Promise<{ userId: UserId; tenantId: TenantId; userRoles: UserRole[] }[]>;
};

export type EmailNotificationReadModelService = NotificationReadModelService & {
  getTenantNotificationConfigByTenantId: (
    tenantId: TenantId
  ) => Promise<TenantNotificationConfig | undefined>;
};

export type TenantEmailNotificationRecipient = {
  type: "Tenant";
  tenantId: TenantId;
  selfcareId: string | undefined;
  address: string;
};

export type UserEmailNotificationRecipient = {
  type: "User";
  userId: UserId;
  tenantId: TenantId;
  selfcareId: string | undefined;
};

export type EmailNotificationRecipient =
  | TenantEmailNotificationRecipient
  | UserEmailNotificationRecipient;

export type HandlerCommonParams<
  TReadModelService extends NotificationReadModelService,
> = {
  readModelService: TReadModelService;
  logger: Logger;
  templateService: HtmlTemplateService;
  correlationId: CorrelationId;
};

export type HandlerParams<
  T extends z.ZodType,
  TReadModelService extends NotificationReadModelService,
> = HandlerCommonParams<TReadModelService> & {
  decodedMessage: EventEnvelope<z.infer<T>>;
};
