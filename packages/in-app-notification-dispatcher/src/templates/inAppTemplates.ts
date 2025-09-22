import { match } from "ts-pattern";
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
};
