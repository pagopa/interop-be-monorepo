import { match } from "ts-pattern";
import { DelegationApprovedRejectedToDelegatorEventType } from "../handlers/delegations/handleDelegationApprovedRejectedToDelegator.js";
import { DelegationSubmittedRevokedToDelegateEventType } from "../handlers/delegations/handleDelegationSubmittedRevokedToDelegate.js";
import { EserviceNewVersionApprovedRejectedToDelegateEventType } from "../handlers/eservices/handleEserviceNewVersionApprovedRejectedToDelegate.js";

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
