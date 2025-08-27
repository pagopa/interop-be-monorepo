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
  agreementManagementToProducer: z.boolean(), // 03: Gestione richieste di fruizione
  clientAddedRemovedToProducer: z.boolean(), // 05: Associazione di un client da parte del fruitore
  purposeStatusChangedToProducer: z.boolean(), // 07: Variazione stato di una finalità
  templateStatusChangedToProducer: z.boolean(), // 09: Variazione stato template

  // Fruizione (Consumer) notifications
  agreementSuspendedUnsuspendedToConsumer: z.boolean(), // 13: Sospensione o riattivazione richiesta di fruizione
  eserviceStateChangedToConsumer: z.boolean(), // 11: Variazione di stato e-service
  agreementActivatedRejectedToConsumer: z.boolean(), // 12: Attivazione o rifiuto richiesta di fruizione
  purposeActivatedRejectedToConsumer: z.boolean(), // 15: Attivazione o rifiuto finalità
  purposeSuspendedUnsuspendedToConsumer: z.boolean(), // 16: Sospensione o riattivazione finalità
  newEserviceTemplateVersionToInstantiator: z.boolean(), // 17: Nuova versione di template
  eserviceTemplateNameChangedToInstantiator: z.boolean(), // 18: Variazione proprietà template
  eserviceTemplateStatusChangedToInstantiator: z.boolean(), // 19: Variazione stato template

  // Deleghe (Delegations) notifications
  delegationApprovedRejectedToDelegator: z.boolean(), // 20: Stato di accettazione di una delega
  eserviceNewVersionSubmittedToDelegator: z.boolean(), // 21: Richiesta approvazione pubblicazione nuova versione e-service
  eserviceNewVersionApprovedRejectedToDelegate: z.boolean(), // 22: Accettazione o rifiuto pubblicazione nuova versione e-service
  delegationSubmittedRevokedToDelegate: z.boolean(), // 23: Stato delle deleghe ricevute

  // Attributi (Attributes) notifications
  certifiedVerifiedAttributeAssignedRevokedToAssignee: z.boolean(), // 24: Conferimento o revoca di attributi certificati o verificati

  // Chiavi (Keys) notifications
  clientKeyAddedDeletedToClientUsers: z.boolean(), // 25: Variazioni sullo stato delle chiavi collegate ad un client
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
