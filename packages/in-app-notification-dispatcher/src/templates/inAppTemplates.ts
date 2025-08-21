export const inAppTemplates = {
  eserviceStateChangedToConsumer: (eserviceName: string): string =>
    `Gentile aderente, ti informiamo che per l'e-service <strong>${eserviceName}</strong>, è stata pubblicata una nuova versione. Pertanto, ti consigliamo di procedere all'aggiornamento dell'e-service alla versione più recente.`,
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
    `${producerName} ha ${action} la richiesta di fruizione relativa all'e-service <strong>${eserviceName}</strong>`,
  templateStatusChangedToProducer: (templateName: string): string =>
    `Hai sospeso il tuo template "<strong>${templateName}</strong>".`,
  newEserviceTemplateVersionToInstantiator: (
    creatorName: string,
    eserviceTemplateVersion: string,
    eserviceTemplateName: string
  ): string =>
    `${creatorName} ha pubblicato una nuova versione ${eserviceTemplateVersion} del template "<strong>${eserviceTemplateName}</strong>" per il tuo e-service.`,
  eserviceTemplateNameChangedToInstantiator: (
    creatorName: string,
    eserviceTemplateName: string
  ): string =>
    `${creatorName} ha aggiornato il nome del template "<strong>${eserviceTemplateName}</strong>" per il tuo e-service.`,
  eserviceTemplateStatusChangedToInstantiator: (
    creatorName: string,
    eserviceTemplateName: string
  ): string =>
    `${creatorName} ha sospeso il template "<strong>${eserviceTemplateName}</strong>" per il tuo e-service.`,
};
