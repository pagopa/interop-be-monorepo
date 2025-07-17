export const inAppTemplates = {
  eserviceStateChangedToConsumer: (eserviceName: string): string =>
    `Gentile aderente, ti informiamo che per l'e-service <strong>${eserviceName}</strong>, è stata pubblicata una nuova versione. Pertanto, ti consigliamo di procedere all'aggiornamento dell'e-service alla versione più recente.`,
  agreementSuspendedUnsuspended: (
    action: "sospeso" | "riattivato",
    subjectName: string,
    eserviceName: string
  ): string =>
    `${subjectName} ha ${action} la richiesta di fruizione relativa all'e-service <strong>${eserviceName}</strong>.`,
};
