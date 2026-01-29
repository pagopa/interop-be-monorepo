import { z } from "zod";
import {
  UserId,
  TenantId,
  NotificationId,
  IDS,
  EServiceIdDescriptorId,
  EServiceTemplateIdEServiceTemplateVersionId,
} from "../brandedIds.js";

export const NotificationType = z.enum([
  "agreementSuspendedUnsuspendedToProducer", // 04: Variazione dello stato di una richiesta di fruizione
  "agreementManagementToProducer", // 03: Gestione richieste di fruizione
  "clientAddedRemovedToProducer", // 05: Associazione di un client da parte del fruitore
  "purposeStatusChangedToProducer", // 07: Variazione stato di una finalità
  "templateStatusChangedToProducer", // 09: Variazione stato template
  "agreementSuspendedUnsuspendedToConsumer", // 13: Sospensione o riattivazione richiesta di fruizione
  "eserviceStateChangedToConsumer", // 11: Variazione di stato e-service
  "agreementActivatedRejectedToConsumer", // 12: Attivazione o rifiuto richiesta di fruizione
  "purposeActivatedRejectedToConsumer", // 15: Attivazione o rifiuto finalità
  "purposeSuspendedUnsuspendedToConsumer", // 16: Sospensione o riattivazione finalità
  "newEserviceTemplateVersionToInstantiator", // 17: Nuova versione di template
  "eserviceTemplateNameChangedToInstantiator", // 18: Variazione proprietà template
  "eserviceTemplateStatusChangedToInstantiator", // 19: Variazione stato template
  "delegationApprovedRejectedToDelegator", // 20: Stato di accettazione di una delega
  "eserviceNewVersionSubmittedToDelegator", // 21: Richiesta approvazione pubblicazione nuova versione e-service
  "eserviceNewVersionApprovedRejectedToDelegate", // 22: Accettazione o rifiuto pubblicazione nuova versione e-service
  "delegationSubmittedRevokedToDelegate", // 23: Stato delle deleghe ricevute
  "certifiedVerifiedAttributeAssignedRevokedToAssignee", // 24: Conferimento o revoca di attributi certificati o verificati
  "clientKeyAddedDeletedToClientUsers", // 25: Variazioni sullo stato delle chiavi collegate ad un client (ClientKey)
  "clientKeyConsumerAddedDeletedToClientUsers", // 25: Variazioni sullo stato delle chiavi collegate ad un client (ClientKeyConsumer)
  "producerKeychainKeyAddedDeletedToClientUsers", // 25: Variazioni sullo stato delle chiavi collegate ad un client (ProducerKeychain)
  "purposeQuotaAdjustmentRequestToProducer", // 06: Richiesta adeguamento piano di carico finalità
  "purposeOverQuotaStateToConsumer", // 14: Superamento soglia piano di carico finalità
]);
export type NotificationType = z.infer<typeof NotificationType>;

export const Notification = z.object({
  id: NotificationId,
  userId: UserId,
  tenantId: TenantId,
  body: z.string(),
  notificationType: NotificationType,
  entityId: z.union([
    IDS,
    EServiceIdDescriptorId,
    EServiceTemplateIdEServiceTemplateVersionId,
  ]),
  readAt: z.date().optional(),
  createdAt: z.date(),
});

export type Notification = z.infer<typeof Notification>;

export const NewNotification = Notification.omit({
  id: true,
  createdAt: true,
  readAt: true,
});
export type NewNotification = z.infer<typeof NewNotification>;

const notificationsByTypeResults = Object.fromEntries(
  NotificationType.options.map((key) => [key, z.number()])
) as {
  [K in (typeof NotificationType.options)[number]]: z.ZodNumber;
};

export const NotificationsByType = z.object({
  results: z.object(notificationsByTypeResults),
  totalCount: z.number(),
});
export type NotificationsByType = z.infer<typeof NotificationsByType>;
