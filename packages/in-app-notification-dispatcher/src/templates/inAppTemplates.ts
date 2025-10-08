import { match } from "ts-pattern";
import { EServiceTemplate } from "pagopa-interop-models";
import { EService } from "pagopa-interop-models";
import { DelegationApprovedRejectedToDelegatorEventType } from "../handlers/delegations/handleDelegationApprovedRejectedToDelegator.js";
import { DelegationSubmittedRevokedToDelegateEventType } from "../handlers/delegations/handleDelegationSubmittedRevokedToDelegate.js";
import { EserviceNewVersionApprovedRejectedToDelegateEventType } from "../handlers/eservices/handleEserviceNewVersionApprovedRejectedToDelegate.js";

export const inAppTemplates = {
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
    producerName: string
  ): string =>
    `L'ente erogatore <strong>${producerName}</strong> ha aggiornato la descrizione dell'e-service <strong>${eserviceName}</strong>.`,
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
    `L'ente erogatore <strong>${producerName}</strong> ha pubblicato una nuova versione ${
      version ?? ""
    } per l'e-service <strong>${eserviceName}</strong>.`,
  eserviceDescriptorSuspendedToConsumer: (
    eserviceName: string,
    producerName: string
  ): string =>
    `L'ente erogatore <strong>${producerName}</strong> ha sospeso l'e-service <strong>${eserviceName}</strong>.`,
  eserviceDescriptorActivatedToConsumer: (
    eserviceName: string,
    producerName: string
  ): string =>
    `L'ente erogatore <strong>${producerName}</strong> ha riattivato l'e-service <strong>${eserviceName}</strong>.`,
  eserviceDescriptorQuotasUpdatedToConsumer: (
    eserviceName: string,
    producerName: string
  ): string =>
    `L'ente erogatore <strong>${producerName}</strong> ha aggiornato le quote dell'e-service <strong>${eserviceName}</strong>.`,
  eserviceDescriptorAgreementApprovalPolicyUpdatedToConsumer: (
    eserviceName: string,
    producerName: string
  ): string =>
    `L'ente erogatore <strong>${producerName}</strong> ha aggiornato la politica di approvazione dell'e-service <strong>${eserviceName}</strong>.`,
  eserviceDescriptorInterfaceAddedToConsumer: (
    eserviceName: string,
    interfaceName = "",
    producerName: string
  ): string =>
    `L'ente erogatore <strong>${producerName}</strong> ha aggiunto l'interfaccia <strong>${interfaceName}</strong> dell'e-service <strong>${eserviceName}</strong>.`,
  eserviceDescriptorDocumentAddedToConsumer: (
    eserviceName: string,
    documentName = "",
    producerName: string
  ): string =>
    `L'ente erogatore <strong>${producerName}</strong> ha aggiunto il documento <strong>${documentName}</strong> dell'e-service <strong>${eserviceName}</strong>.`,
  eserviceDescriptorInterfaceUpdatedToConsumer: (
    eserviceName: string,
    interfaceName = "",
    producerName: string
  ): string =>
    `L'ente erogatore <strong>${producerName}</strong> ha aggiornato l'interfaccia <strong>${interfaceName}</strong> dell'e-service <strong>${eserviceName}</strong>.`,
  eserviceDescriptorDocumentUpdatedToConsumer: (
    eserviceName: string,
    documentName = "",
    producerName: string
  ): string =>
    `L'ente erogatore <strong>${producerName}</strong> ha aggiornato il documento <strong>${documentName}</strong> dell'e-service <strong>${eserviceName}</strong>.`,
  eserviceDescriptorDocumentDeletedToConsumer: (
    eserviceName: string,
    documentName = "",
    producerName: string
  ): string =>
    `L'ente erogatore <strong>${producerName}</strong> ha rimosso il documento <strong>${documentName}</strong> dell'e-service <strong>${eserviceName}</strong>.`,
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
  delegationApprovedRejectedToDelegator: (
    delegateName: string,
    eventType: DelegationApprovedRejectedToDelegatorEventType,
    rejectionReason: string | undefined
  ): string => {
    const { action, delegationKind, reason } = match(eventType)
      .with("ProducerDelegationApproved", () => ({
        action: "approvato",
        delegationKind: "erogazione",
        reason: "",
      }))
      .with("ConsumerDelegationApproved", () => ({
        action: "approvato",
        delegationKind: "fruizione",
        reason: "",
      }))
      .with("ProducerDelegationRejected", () => ({
        action: "rifiutato",
        delegationKind: "erogazione",
        reason: rejectionReason ? ` Motivo: ${rejectionReason}.` : "",
      }))
      .with("ConsumerDelegationRejected", () => ({
        action: "rifiutato",
        delegationKind: "fruizione",
        reason: rejectionReason ? ` Motivo: ${rejectionReason}.` : "",
      }))
      .exhaustive();
    return `${delegateName} ha ${action} la delega in ${delegationKind}.${reason}`;
  },
  eserviceNewVersionSubmittedToDelegator: (
    delegateName: string,
    eserviceName: string
  ): string =>
    `${delegateName} ha richiesto l'approvazione di una nuova versione dell'e-service <strong>${eserviceName}</strong>.`,
  eserviceNewVersionApprovedRejectedToDelegate: (
    delegatorName: string,
    eserviceName: string,
    eventType: EserviceNewVersionApprovedRejectedToDelegateEventType,
    rejectionReason: string | undefined
  ): string => {
    const { action, reason } = match(eventType)
      .with("EServiceDescriptorApprovedByDelegator", () => ({
        action: "approvato",
        reason: "",
      }))
      .with("EServiceDescriptorRejectedByDelegator", () => ({
        action: "rifiutato",
        reason: rejectionReason ? ` Motivo: ${rejectionReason}.` : "",
      }))
      .exhaustive();
    return `${delegatorName} ha ${action} la nuova versione dell'e-service <strong>${eserviceName}</strong>.${reason}`;
  },
  delegationSubmittedRevokedToDelegate: (
    delegatorName: string,
    eventType: DelegationSubmittedRevokedToDelegateEventType
  ): string => {
    const { action, delegationKind } = match(eventType)
      .with("ProducerDelegationSubmitted", () => ({
        action: "conferito",
        delegationKind: "erogazione",
      }))
      .with("ConsumerDelegationSubmitted", () => ({
        action: "conferito",
        delegationKind: "fruizione",
      }))
      .with("ProducerDelegationRevoked", () => ({
        action: "revocato",
        delegationKind: "erogazione",
      }))
      .with("ConsumerDelegationRevoked", () => ({
        action: "revocato",
        delegationKind: "fruizione",
      }))
      .exhaustive();
    return `${delegatorName} ha ${action} una delega in ${delegationKind}.`;
  },
  templateStatusChangedToProducer: (templateName: string): string =>
    `Hai sospeso il tuo template "<strong>${templateName}</strong>".`,
  newEserviceTemplateVersionToInstantiator: (
    creatorName: string,
    eserviceTemplateVersion: string,
    eserviceTemplateName: string
  ): string =>
    `${creatorName} ha pubblicato una nuova versione ${eserviceTemplateVersion} del template "<strong>${eserviceTemplateName}</strong>" per il tuo e-service.`,
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
    `${creatorName} ha sospeso il template "<strong>${eserviceTemplateName}</strong>" per il tuo e-service.`,
  purposeStatusChangedToConsumer: (
    purposeName: string,
    consumerName: string,
    eserviceName: string,
    action: "sospeso" | "riattivato" | "archiviato"
  ): string =>
    `Ti informiamo che l'ente ${consumerName} ha ${action} la finalità <strong>${purposeName}</strong>, associata al tuo e-service <strong>${eserviceName}</strong>.`,
  purposeSuspendedUnsuspendedToConsumer: (
    purposeName: string,
    producerName: string,
    eserviceName: string,
    action: "sospeso" | "riattivato"
  ): string =>
    `L'ente erogatore ${producerName} ha ${action} la finalità <strong>${purposeName}</strong>, associata all'e-service <strong>${eserviceName}</strong>.`,
  purposeActivatedRejectedToConsumer: (
    purposeName: string,
    producerName: string,
    eserviceName: string,
    action: "attivato" | "rifiutato"
  ): string =>
    `L'ente erogatore ${producerName} ha ${action} la finalità <strong>${purposeName}</strong>, associata all'e-service <strong>${eserviceName}</strong>.`,
  clientAddedRemovedToProducer: (
    purposeName: string,
    eserviceName: string,
    consumerName: string,
    action: "associato" | "disassociato"
  ): string =>
    `L'ente ${consumerName} ha ${action} un proprio client alla finalità ${purposeName} per il tuo e-service ${eserviceName}`,
  certifiedVerifiedAttributeAssignedToAssignee: (
    attributeName: string,
    attributeKind: "certificato" | "verificato",
    assignerName: string
  ): string =>
    `${assignerName} ti ha conferito l'attributo ${attributeKind} "${attributeName}". Puoi ora utilizzarlo nelle richieste di fruizione.`,
  certifiedVerifiedAttributeRevokedToAssignee: (
    attributeName: string,
    attributeKind: "certificato" | "verificato",
    revokerName: string
  ): string =>
    `Ti informiamo che ${revokerName} ti ha revocato l'attributo ${attributeKind} "${attributeName}". Tutte le richieste di fruizione che utilizzano tale attributo subiranno una sospensione. Non potrai più utilizzare questo attributo per le future richieste di fruizione`,
  producerKeychainEServiceAddedToConsumer: (
    producerName: string,
    eserviceName: string
  ): string =>
    `Ti informiamo che l'ente erogatore <strong>${producerName}</strong> ha aggiunto un nuovo livello di sicurezza (portachiavi) all'e-service <strong>${eserviceName}</strong>.`,
  clientKeyDeletedToClientUsers: (
    clientName: string,
    userId: string,
    kid: string
  ): string =>
    `L'utente ${userId} ha rimosso la chiave ${kid} dal client ${clientName}. Assicurati che l'operatività non sia compromessa.`,
  clientKeyAddedToClientUsers: (clientName: string): string =>
    `Ti informiamo che é stata aggiunta una nuova chiave al client ${clientName}.`,
  clientUserDeletedToClientUsers: (clientName: string): string =>
    `Una chiave associata al client ${clientName} non é più considerata sicura, in quanto l'operatore che l'ha caricata non é più attivo. La chiave deve essere sostituita per garantire la sicurezza e l'operatività`,
  producerKeychainKeyDeletedToClientUsers: (
    producerKeychainName: string,
    userId: string,
    kid: string
  ): string =>
    `L'utente ${userId} ha rimosso la chiave ${kid} di e-service dal client ${producerKeychainName}. Assicurati che l'operatività non sia compromessa.`,
  producerKeychainKeyAddedToClientUsers: (
    producerKeychainName: string
  ): string =>
    `Ti informiamo che é stata aggiunta una nuova chiave e-service al client ${producerKeychainName}.`,
  producerKeychainUserDeletedToClientUsers: (
    producerKeychainName: string
  ): string =>
    `Una chiave associata al client ${producerKeychainName} non é più considerata sicura, in quanto l'operatore che l'ha caricata non é più attivo. La chiave deve essere sostituita per garantire la sicurezza e l'operatività`,
};
