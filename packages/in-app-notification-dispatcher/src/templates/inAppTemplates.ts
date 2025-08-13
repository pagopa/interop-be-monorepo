export const inAppTemplates = {
  eserviceDescriptorPublishedToConsumer: (eserviceName: string): string =>
    `L'e-service <strong>${eserviceName}</strong> è stata pubblicata una nuova versione. Pertanto, ti consigliamo di procedere all'aggiornamento dell'e-service alla versione più recente.`,
  eserviceDescriptorSuspendedToConsumer: (eserviceName: string): string =>
    `L'e-service <strong>${eserviceName}</strong> è stata sospeso.`,
  eserviceDescriptorActivatedToConsumer: (eserviceName: string): string =>
    `L'e-service <strong>${eserviceName}</strong> è stato riattivato.`,
  eserviceDescriptorQuotasUpdatedToConsumer: (eserviceName: string): string =>
    `Le quote dell'e-service <strong>${eserviceName}</strong> sono state aggiornate.`,
  eserviceDescriptorAgreementApprovalPolicyUpdatedToConsumer: (
    eserviceName: string
  ): string =>
    `La politica di approvazione dell'e-service <strong>${eserviceName}</strong> è stata aggiornata.`,
  eserviceDescriptorInterfaceAddedToConsumer: (eserviceName: string): string =>
    `L'interfaccia dell'e-service <strong>${eserviceName}</strong> è stata aggiornata.`,
  eserviceDescriptorDocumentAddedToConsumer: (eserviceName: string): string =>
    `Il documento dell'e-service <strong>${eserviceName}</strong> è stato aggiunto.`,
  eserviceDescriptorInterfaceUpdatedToConsumer: (
    eserviceName: string
  ): string =>
    `L'interfaccia dell'e-service <strong>${eserviceName}</strong> è stata aggiornata.`,
  eserviceDescriptorDocumentUpdatedToConsumer: (eserviceName: string): string =>
    `Il documento dell'e-service <strong>${eserviceName}</strong> è stato aggiornato.`,
  eserviceDescriptorDocumentDeletedToConsumer: (eserviceName: string): string =>
    `Il documento dell'e-service <strong>${eserviceName}</strong> è stato rimosso.`,
  eserviceNameUpdatedByTemplateUpdateToConsumer: (
    eserviceName: string
  ): string =>
    `Il nome dell'e-service <strong>${eserviceName}</strong> è stato aggiornato a causa della modifica del template associato.`,
  eserviceDescriptionUpdatedByTemplateUpdateToConsumer: (
    eserviceName: string
  ): string =>
    `La descrizione dell'e-service <strong>${eserviceName}</strong> è stata aggiornata a causa della modifica del template associato.`,
  eserviceDescriptorAttributesUpdatedByTemplateUpdateToConsumer: (
    eserviceName: string
  ): string =>
    `Gli attributi dell'e-service <strong>${eserviceName}</strong> sono stati aggiornati a causa della modifica del template associato.`,
  eserviceDescriptorQuotasUpdatedByTemplateUpdateToConsumer: (
    eserviceName: string
  ): string =>
    `Le quote dell'e-service <strong>${eserviceName}</strong> sono state aggiornate a causa della modifica del template associato.`,
  eserviceDescriptorDocumentAddedByTemplateUpdateToConsumer: (
    eserviceName: string
  ): string =>
    `Il documento dell'e-service <strong>${eserviceName}</strong> è stato aggiunto a causa della modifica del template associato.`,
  eserviceDescriptorDocumentDeletedByTemplateUpdateToConsumer: (
    eserviceName: string
  ): string =>
    `Il documento dell'e-service <strong>${eserviceName}</strong> è stato rimosso a causa della modifica del template associato.`,
  eserviceDescriptorDocumentUpdatedByTemplateUpdateToConsumer: (
    eserviceName: string
  ): string =>
    `Il documento dell'e-service <strong>${eserviceName}</strong> è stato aggiornato a causa della modifica del template associato.`,

  agreementSuspendedUnsuspended: (
    action: "sospeso" | "riattivato" | "archiviato",
    subjectName: string,
    eserviceName: string
  ): string =>
    `${subjectName} ha ${action} la richiesta di fruizione relativa all'e-service <strong>${eserviceName}</strong>.`,
  agreementManagementToProducer: (
    consumerName: string,
    eserviceName: string,
    action: "attivato" | "creato" | "aggiornato"
  ): string =>
    `${consumerName} ha ${action} la richiesta di fruizione relativa all'e-service <strong>${eserviceName}</strong>.`,
  agreementActivatedRejectedToConsumer: (
    consumerName: string,
    eserviceName: string,
    action: "attivato" | "rifiuto"
  ): string =>
    `${consumerName} ha ${action} la richiesta di fruizione relativa all'e-service <strong>${eserviceName}</strong>.`,
};
