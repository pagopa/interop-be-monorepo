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
    `${producerName} ha ${action} la richiesta di fruizione relativa all'e-service <strong>${eserviceName}</strong>.`,
  purposeStatusChangedToConsumer: (
    purposeName: string,
    consumerName: string,
    eserviceName: string,
    action: "sospeso" | "riattivato" | "archiviato"
  ): string =>
    `Ti informiamo che l'ente ${consumerName} ha ${action} la finalità <strong>${purposeName}</strong>, associata al tuo e-service <strong>${eserviceName}</strong>.`,
};
