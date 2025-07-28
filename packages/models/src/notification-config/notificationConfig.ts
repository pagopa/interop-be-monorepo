import z from "zod";
import {
  TenantNotificationConfigId,
  TenantId,
  UserNotificationConfigId,
  UserId,
} from "../brandedIds.js";

export const NotificationConfig = z.object({
  // Erogazione (Producer) notifications
  agreementSuspendedUnsuspendedToProducer: z.boolean(), // 04: Variazione dello stato di una richiesta di fruizione
  agreementSubmittedActivatedToProducer: z.boolean(), // 12: Attivazione o rifiuto richiesta di fruizione
  agreementRequestManagementToProducer: z.boolean(), // 03: Gestione richieste di fruizione
  clientAssociationByConsumerToProducer: z.boolean(), // 05: Associazione di un client da parte del fruitore
  consumerThresholdAdjustmentRequestToProducer: z.boolean(), // 06: Richiesta adeguamento soglia fruitore
  purposeStatusChangedToProducer: z.boolean(), // 07: Variazione stato di una finalità
  templateInstantiationToProducer: z.boolean(), // 08: Istanziazione del template
  templateStatusChangedToProducer: z.boolean(), // 09: Variazione stato template

  // Fruizione (Consumer) notifications
  agreementSuspendedUnsuspendedToConsumer: z.boolean(), // 13: Sospensione o riattivazione richiesta di fruizione
  eserviceStatusChangedToConsumer: z.boolean(), // 11: Variazione di stato e-service
  agreementActivationRejectionToConsumer: z.boolean(), // 12: Attivazione o rifiuto richiesta di fruizione
  loadThresholdStatusToConsumer: z.boolean(), // 14: Stato delle soglie di carico
  purposeActivationRejectionToConsumer: z.boolean(), // 15: Attivazione o rifiuto finalità
  purposeSuspensionReactivationToConsumer: z.boolean(), // 16: Sospensione o riattivazione finalità
  newTemplateVersionToConsumer: z.boolean(), // 17: Nuova versione di template
  templatePropertiesChangedToConsumer: z.boolean(), // 18: Variazione proprietà template
  templateStatusChangedToConsumer: z.boolean(), // 19: Variazione stato template

  // Deleghe (Delegations) notifications
  delegationAcceptanceStatusChangedToDelegator: z.boolean(), // 20: Stato di accettazione di una delega
  eserviceNewVersionPublicationApprovalRequestToDelegator: z.boolean(), // 21: Richiesta approvazione pubblicazione nuova versione e-service
  eserviceNewVersionPublicationAcceptanceRejectionToDelegate: z.boolean(), // 22: Accettazione o rifiuto pubblicazione nuova versione e-service
  receivedDelegationsStatusToDelegate: z.boolean(), // 22: Stato delle deleghe ricevute

  // Attributi (Attributes) notifications
  certifiedVerifiedAttributesGrantRevocationToAdherent: z.boolean(), // 23: Conferimento o revoca di attributi certificati o verificati

  // Chiavi (Keys) notifications
  clientKeysStatusChanged: z.boolean(), // 24: Variazioni sullo stato delle chiavi collegate ad un client

  // Comunicazioni (Communications) notifications
  platformCommunications: z.boolean(), // 25: Comunicazioni in piattaforma
});
export type NotificationConfig = z.infer<typeof NotificationConfig>;

export const TenantNotificationConfig = z.object({
  id: TenantNotificationConfigId,
  tenantId: TenantId,
  config: NotificationConfig,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});
export type TenantNotificationConfig = z.infer<typeof TenantNotificationConfig>;

export const UserNotificationConfig = z.object({
  id: UserNotificationConfigId,
  userId: UserId,
  tenantId: TenantId,
  inAppConfig: NotificationConfig,
  emailConfig: NotificationConfig,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
});
export type UserNotificationConfig = z.infer<typeof UserNotificationConfig>;
