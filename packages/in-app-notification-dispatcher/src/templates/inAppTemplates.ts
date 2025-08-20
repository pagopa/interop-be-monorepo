export const inAppTemplates = {
  eserviceNameUpdatedToConsumer: (eserviceName: string): string =>
    `Il nome dell'e-service <strong>${eserviceName}</strong> è stato aggiornato.`,
  eserviceDescriptionUpdatedToConsumer: (eserviceName: string): string =>
    `La descrizione dell'e-service <strong>${eserviceName}</strong> è stata aggiornata.`,
  eserviceDescriptorAttributesUpdatedToConsumer: (
    eserviceName: string
  ): string =>
    `Gli attributi dell'e-service <strong>${eserviceName}</strong> sono stati aggiornati.`,
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
  eserviceDescriptorInterfaceAddedToConsumer: (
    eserviceName: string,
    interfaceName = ""
  ): string =>
    `L'interfaccia <strong>${interfaceName}</strong> dell'e-service <strong>${eserviceName}</strong> è stata aggiunta.`,
  eserviceDescriptorDocumentAddedToConsumer: (
    eserviceName: string,
    documentName = ""
  ): string =>
    `Il documento <strong>${documentName}</strong> dell'e-service <strong>${eserviceName}</strong> è stato aggiunto.`,
  eserviceDescriptorInterfaceUpdatedToConsumer: (
    eserviceName: string,
    interfaceName = ""
  ): string =>
    `L'interfaccia <strong>${interfaceName}</strong> dell'e-service <strong>${eserviceName}</strong> è stata aggiornata.`,
  eserviceDescriptorDocumentUpdatedToConsumer: (
    eserviceName: string,
    documentName = ""
  ): string =>
    `Il documento <strong>${documentName}</strong> dell'e-service <strong>${eserviceName}</strong> è stato aggiornato.`,
  eserviceDescriptorDocumentDeletedToConsumer: (
    eserviceName: string,
    documentName = ""
  ): string =>
    `Il documento <strong>${documentName}</strong> dell'e-service <strong>${eserviceName}</strong> è stato rimosso.`,
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
    producerName: string,
    eserviceName: string,
    action: "attivato" | "rifiutato"
  ): string =>
    `${producerName} ha ${action} la richiesta di fruizione relativa all'e-service <strong>${eserviceName}</strong>.`,
};
