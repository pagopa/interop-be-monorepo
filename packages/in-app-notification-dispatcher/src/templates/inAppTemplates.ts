import { match } from "ts-pattern";
import { EServiceTemplate } from "pagopa-interop-models";
import { EService } from "pagopa-interop-models";
import { DelegationApprovedRejectedToDelegatorEventType } from "../handlers/delegations/handleDelegationApprovedRejectedToDelegator.js";
import { EserviceNewVersionApprovedRejectedToDelegateEventType } from "../handlers/eservices/handleEserviceNewVersionApprovedRejectedToDelegate.js";

export const inAppTemplates = {
  // agreements - erogazione
  agreementSubmittedToProducer: (
    consumerName: string,
    eserviceName: string
  ): string =>
    `Hai ricevuto una nuova richiesta di fruizione per l'e-service <strong>${eserviceName}</strong> formulata da parte di ${consumerName}.`,
  agreementActivatedToProducer: (
    consumerName: string,
    eserviceName: string
  ): string =>
    `È stata accettata una richiesta di fruizione per l'e-service <strong>${eserviceName}</strong> formulata da parte di ${consumerName}.`,
  agreementUpgradedToProducer: (
    consumerName: string,
    eserviceName: string
  ): string =>
    `L'ente ${consumerName} ha aggiornato la propria richiesta di fruizione per l'e-service <strong>${eserviceName}</strong> alla versione più recente.`,
  agreementSuspendedByConsumerToProducer: (
    consumerName: string,
    eserviceName: string
  ): string =>
    `L'ente ${consumerName} ha sospeso la propria richiesta di fruizione per il suo e-service <strong>${eserviceName}</strong>.`,
  agreementSuspendedByPlatformToProducer: (
    consumerName: string,
    eserviceName: string
  ): string =>
    `La Piattaforma PDND ha sospeso la richiesta di fruizione del fruitore ${consumerName} per il tuo e-service <strong>${eserviceName}</strong>, in quanto l'ente fruitore non dispone più dei requisiti per poter fruire di questi dati.`,
  agreementUnsuspendedByConsumerToProducer: (
    consumerName: string,
    eserviceName: string
  ): string =>
    `L'ente ${consumerName} ha riattivato la propria richiesta di fruizione per il tuo e-service <strong>${eserviceName}</strong>, precedentemente sospesa.`,
  agreementUnsuspendedByPlatformToProducer: (
    consumerName: string,
    eserviceName: string
  ): string =>
    `La Piattaforma PDND ha riattivato la richiesta di fruizione del fruitore ${consumerName} per il tuo e-service <strong>${eserviceName}</strong>, precedentemente sospesa.`,
  agreementArchivedByConsumerToProducer: (
    consumerName: string,
    eserviceName: string
  ): string =>
    `Ti informiamo che il fruitore ${consumerName} ha archiviato la sua richiesta di fruizione per il tuo e-service <strong>${eserviceName}</strong>.`,

  // agreements - fruizione
  agreementSuspendedByProducerToConsumer: (
    producerName: string,
    eserviceName: string
  ): string =>
    `L'ente erogatore ${producerName} ha sospeso la richiesta di fruizione formulata dal tuo ente per l'e-service <strong>${eserviceName}</strong>. Non potrai utilizzare i voucher associati fino alla riattivazione.`,
  agreementUnsuspendedByProducerToConsumer: (
    producerName: string,
    eserviceName: string
  ): string =>
    `L'ente erogatore ${producerName} ha riattivato la richiesta di fruizione formulata dal tuo ente per l'e-service "<strong>${eserviceName}</strong>", precedentemente sospesa. Puoi nuovamente utilizzare i voucher associati.`,
  agreementSuspendedByPlatformToConsumer: (eserviceName: string): string =>
    `La Piattaforma PDND ha sospeso la richiesta di fruizione formulata dal tuo ente per l'e-service <strong>${eserviceName}</strong>, in quanto non risultano più soddisfatti i requisiti necessari. `,
  agreementUnsuspendedByPlatformToConsumer: (eserviceName: string): string =>
    `La Piattaforma PDND ha riattivato la richiesta di fruizione formulata dal tuo ente per l'e-service "<strong>${eserviceName}</strong>", precedentemente sospesa.`,
  agreementActivatedToConsumer: (
    producerName: string,
    eserviceName: string
  ): string =>
    `L'ente erogatore ${producerName} ha accettato la richiesta di fruizione formulata dal tuo ente per l'e-service <strong>${eserviceName}</strong>. Puoi ora procedere alla creazione dei voucher per iniziare a interrogare le API.`,
  agreementRejectedToConsumer: (eserviceName: string): string =>
    `La richiesta di fruizione per l'e-service <strong>${eserviceName}</strong> è stata rifiutata dall'ente erogatore.`,

  // eservices - fruizione
  eserviceNameUpdatedToConsumer: (
    eservice: EService,
    oldName: string | undefined
  ): string =>
    `Ti informiamo che l'e-service ${
      oldName ?? eservice.id
    } è stato rinominato in ${
      eservice.name
    } dall'ente erogatore. La tua richiesta di fruizione rimane attiva e non sono richieste azioni da parte tua.`,
  eserviceDescriptionUpdatedToConsumer: (
    eserviceName: string,
    version: string | undefined,
    producerName: string
  ): string =>
    `L'ente erogatore <strong>${producerName}</strong> ha modificato la descrizione nella versione ${
      version ?? ""
    } dell'e-service <strong>${eserviceName}</strong> a cui sei iscritto.`,
  eserviceDescriptorAttributesUpdatedToConsumer: (
    eserviceName: string,
    producerName: string
  ): string =>
    `L'ente erogatore <strong>${producerName}</strong> ha aggiornato gli attributi dell'e-service <strong>${eserviceName}</strong>.`,
  eserviceDescriptorPublishedToConsumer: (
    eserviceName: string,
    version: string | undefined,
    producerName: string
  ): string =>
    `È disponibile una nuova versione (${
      version ?? ""
    }) per l'e-service "<strong>${eserviceName}</strong>", pubblicato da <strong>${producerName}</strong>.`,
  eserviceDescriptorSuspendedToConsumer: (
    eserviceName: string,
    producerName: string,
    version: string | undefined
  ): string =>
    `L'ente erogatore <strong>${producerName}</strong> ha sospeso ha sospeso la versione ${
      version ?? ""
    } dell'e-service <strong>${eserviceName}</strong>, a cui sei iscritto.`,
  eserviceDescriptorActivatedToConsumer: (
    eserviceName: string,
    producerName: string,
    version: string | undefined
  ): string =>
    `L'ente erogatore <strong>${producerName}</strong> ha riattivato la versione ${
      version ?? ""
    } dell'e-service <strong>${eserviceName}</strong>, precedentemente sospesa.`,
  eserviceDescriptorQuotasUpdatedToConsumer: (
    eserviceName: string,
    version: string | undefined,
    producerName: string
  ): string =>
    `L'ente erogatore <strong>${producerName}</strong> ha apportato delle modifiche alle soglie di carico della versione ${
      version ?? ""
    } dell'e-service <strong>${eserviceName}</strong> a cui sei iscritto.`,
  eserviceDescriptorDocumentAddedToConsumer: (
    eserviceName: string,
    version: string | undefined,
    producerName: string
  ): string =>
    `L'ente erogatore <strong>${producerName}</strong> ha aggiunto un documento nella versione ${
      version ?? ""
    } dell'e-service <strong>${eserviceName}</strong> a cui sei iscritto.`,
  eserviceDescriptorDocumentUpdatedToConsumer: (
    eserviceName: string,
    documentName = "",
    version: string | undefined,
    producerName: string
  ): string =>
    `L'ente erogatore <strong>${producerName}</strong> ha aggiornato un documento <strong>${documentName}</strong> della versione ${
      version ?? ""
    } dell'e-service <strong>${eserviceName}</strong>, a cui sei iscritto.`,
  delegationApprovedRejectedToDelegator: (
    eserviceName: string,
    delegateName: string,
    eventType: DelegationApprovedRejectedToDelegatorEventType
  ): string => {
    const { action, delegationKind, additional } = match(eventType)
      .with("ProducerDelegationApproved", () => ({
        action: "approvato",
        delegationKind: "all'erogazione",
        additional: " La delega è ora attiva.",
      }))
      .with("ConsumerDelegationApproved", () => ({
        action: "approvato",
        delegationKind: "alla fruizione",
        additional: " La delega è ora attiva.",
      }))
      .with("ProducerDelegationRejected", () => ({
        action: "rifiutato",
        delegationKind: "all'erogazione",
        additional: undefined,
      }))
      .with("ConsumerDelegationRejected", () => ({
        action: "rifiutato",
        delegationKind: "alla fruizione",
        additional: undefined,
      }))
      .exhaustive();
    return `Ti informiamo che l'ente ${delegateName} ha ${action} la delega ${delegationKind} che il tuo ente gli ha conferito per l'e-service <strong>${eserviceName}</strong>.${
      additional ? additional : ``
    }`;
  },
  eserviceNewVersionSubmittedToDelegator: (
    delegateName: string,
    eserviceName: string
  ): string =>
    `L'ente delegato ${delegateName} richiede la tua approvazione per pubblicare una nuova versione dell'e-service <strong>${eserviceName}</strong>.`,
  eserviceNewVersionApprovedRejectedToDelegate: (
    delegatorName: string,
    eserviceName: string,
    eventType: EserviceNewVersionApprovedRejectedToDelegateEventType
  ): string => {
    const { action } = match(eventType)
      .with("EServiceDescriptorApprovedByDelegator", () => ({
        action: "approvato",
      }))
      .with("EServiceDescriptorRejectedByDelegator", () => ({
        action: "rifiutato",
      }))
      .exhaustive();
    return `L'ente delegante ${delegatorName} ha ${action} la pubblicazione della nuova versione dell'e-service <strong>${eserviceName}</strong> che gestisci tramite delega.`;
  },
  delegationSubmittedToDelegate: (
    eserviceName: string,
    delegatorName: string,
    eventType: "ProducerDelegationSubmitted" | "ConsumerDelegationSubmitted"
  ): string => {
    const { delegationKind } = match(eventType)
      .with("ProducerDelegationSubmitted", () => ({
        delegationKind: "all'erogazione",
      }))
      .with("ConsumerDelegationSubmitted", () => ({
        delegationKind: "alla fruizione",
      }))
      .exhaustive();
    return `Hai ricevuto una richiesta di delega ${delegationKind} dall'ente ${delegatorName} per l'e-service <strong>${eserviceName}</strong>.`;
  },
  delegationRevokedToDelegate: (
    eserviceName: string,
    delegatorName: string,
    eventType: "ProducerDelegationRevoked" | "ConsumerDelegationRevoked"
  ): string => {
    const { delegationKind } = match(eventType)
      .with("ProducerDelegationRevoked", () => ({
        delegationKind: "all'erogazione",
      }))
      .with("ConsumerDelegationRevoked", () => ({
        delegationKind: "alla fruizione",
      }))
      .exhaustive();
    return `Ti informiamo che l'ente ${delegatorName} ha revocato la delega ${delegationKind} per l'e-service <strong>${eserviceName}</strong> che ti aveva conferito.`;
  },
  templateStatusChangedToProducer: (
    templateName: string,
    producerName: string
  ): string =>
    `L'ente ${producerName} ha sospeso il template "<strong>${templateName}</strong>", da cui il tuo ente ha generato l'e-service.`,
  newEserviceTemplateVersionToInstantiator: (
    creatorName: string,
    eserviceTemplateVersion: string,
    eserviceTemplateName: string
  ): string =>
    `L'ente ${creatorName} ha pubblicato una nuova versione ${eserviceTemplateVersion} del template "<strong>${eserviceTemplateName}</strong>".`,
  eserviceTemplateNameChangedToInstantiator: (
    eserviceTemplate: EServiceTemplate,
    oldName: string | undefined
  ): string =>
    `Ti informiamo che il tuo e-service <strong>${
      oldName ?? eserviceTemplate.id
    }</strong> è stato rinominato in ${
      eserviceTemplate.name
    } in quanto è stato modificato il template e-service da cui lo hai generato.`,
  eserviceTemplateStatusChangedToInstantiator: (
    creatorName: string,
    eserviceTemplateName: string
  ): string =>
    `L'ente ${creatorName} ha sospeso il template "<strong>${eserviceTemplateName}</strong>", da cui il tuo ente ha generato l'e-service.`,
  purposeStatusChangedToConsumer: (
    purposeName: string,
    consumerName: string,
    eserviceName: string,
    action: "sospeso" | "riattivato" | "archiviato"
  ): string =>
    `Ti informiamo che l'ente ${consumerName} ha ${action} la finalità "<strong>${purposeName}</strong>", associata al tuo e-service <strong>${eserviceName}</strong>.`,
  purposeSuspendedUnsuspendedToConsumer: (
    purposeName: string,
    producerName: string,
    eserviceName: string,
    action: "sospeso" | "riattivato"
  ): string =>
    `L'ente erogatore ${producerName} ha ${action} la finalità "<strong>${purposeName}</strong>", associata all'e-service <strong>${eserviceName}</strong>.`,
  purposeActivatedToConsumer: (
    purposeName: string,
    producerName: string,
    eserviceName: string
  ): string =>
    `L'ente erogatore ${producerName} ha approvato la finalità "<strong>${purposeName}</strong>" che hai richiesto per l'e-service <strong>${eserviceName}</strong>.`,
  purposeRejectedToConsumer: (
    purposeName: string,
    producerName: string,
    eserviceName: string
  ): string =>
    `L'ente erogatore ${producerName} ha rifiutato la finalità <strong>${purposeName}</strong> che il tuo ente ha inoltrato per l'e-service <strong>${eserviceName}</strong>.`,
  purposeQuotaAdjustmentNewVersionToProducer: (
    consumerName: string,
    purposeName: string,
    eserviceName: string
  ): string =>
    `L'ente ${consumerName} ha richiesto un adeguamento del piano di carico per la finalità "<strong>${purposeName}</strong>", associata al tuo e-service <strong>${eserviceName}</strong>.`,
  purposeQuotaAdjustmentFirstVersionToProducer: (
    consumerName: string,
    purposeName: string,
    eserviceName: string
  ): string =>
    `L'ente ${consumerName} ha inviato la finalità "<strong>${purposeName}</strong>", che prevede un piano di carico superiore alla tua soglia, associata al tuo e-service <strong>${eserviceName}</strong>.`,
  purposeOverQuotaToConsumer: (
    eserviceName: string,
    dailyCalls: number
  ): string =>
    `La stima di carico complessiva per le finalità associate all'e-service "<strong>${eserviceName}</strong>" ha superato la soglia massima consentita dall'erogatore pari a <strong>${dailyCalls}</strong> chiamate API giornaliere.`,
  purposeQuotaAdjustmentResponseToConsumer: (
    producerName: string,
    purposeName: string,
    eserviceName: string,
    action: "accettato" | "rifiutato"
  ): string =>
    `L'ente erogatore ${producerName} ha ${action} la richiesta di adeguamento del piano di carico formulata dal tuo ente per la finalità "<strong>${purposeName}</strong>", associata all'e-service "<strong>${eserviceName}</strong>".`,
  clientAddedRemovedToProducer: (
    purposeName: string,
    eserviceName: string,
    consumerName: string,
    action: "associato" | "disassociato"
  ): string =>
    `L'ente ${consumerName} ha ${action} un proprio client alla finalità "${purposeName}" per il tuo e-service ${eserviceName}`,
  certifiedVerifiedAttributeAssignedToAssignee: (
    attributeName: string,
    attributeKind: "certificato" | "verificato",
    assignerName: string
  ): string =>
    `L'ente certificatore ${assignerName} ha conferito al tuo ente l'attributo ${attributeKind} "${attributeName}". Puoi ora utilizzarlo nelle richieste di fruizione.`,
  certifiedVerifiedAttributeRevokedToAssignee: (
    attributeName: string,
    attributeKind: "certificato" | "verificato",
    revokerName: string
  ): string =>
    `Ti informiamo che l'ente certificatore  ${revokerName} ha revocato l'attributo ${attributeKind} "${attributeName}". Tutte le richieste di fruizione che utilizzano tale attributo subiranno una sospensione. Non potrai più utilizzare questo attributo per le future richieste di fruizione.`,
  producerKeychainEServiceAddedToConsumer: (
    producerName: string,
    eserviceName: string
  ): string =>
    `Ti informiamo che l'ente erogatore <strong>${producerName}</strong> ha aggiunto un nuovo livello di sicurezza (portachiavi) all'e-service <strong>${eserviceName}</strong>.`,
  clientKeyDeletedToClientUsers: (
    producerKeychainName: string,
    userId: string
  ): string =>
    `L'utente ${userId} ha rimosso una chiave di e-service dal client ${producerKeychainName}. Assicurati che l'operatività non sia compromessa.`,
  clientKeyAddedToClientUsers: (clientName: string): string =>
    `Ti informiamo che è stata aggiunta una nuova chiave e-service al client ${clientName}.`,
  clientUserDeletedToClientUsers: (clientName: string): string =>
    `Una chiave associata al client ${clientName} non è più considerata sicura, in quanto l'operatore che l'ha caricata non è più attivo. La chiave deve essere sostituita per garantire la sicurezza e l'operatività.`,
  producerKeychainKeyDeletedToClientUsers: (
    producerKeychainName: string,
    userId: string
  ): string =>
    `L'utente ${userId} ha rimosso una chiave dal portachiavi erogatore ${producerKeychainName}. Assicurati che l'operatività non sia compromessa.`,
  producerKeychainKeyAddedToClientUsers: (
    producerKeychainName: string
  ): string =>
    `Ti informiamo che è stata aggiunta una nuova chiave al portachiavi erogatore ${producerKeychainName}.`,
  producerKeychainUserDeletedToClientUsers: (
    producerKeychainName: string
  ): string =>
    `Una chiave associata al portachiavi erogatore ${producerKeychainName} non è più considerata sicura, in quanto l'operatore che l'ha caricata non è più attivo. La chiave deve essere sostituita per garantire la sicurezza e l'operatività.`,
};
