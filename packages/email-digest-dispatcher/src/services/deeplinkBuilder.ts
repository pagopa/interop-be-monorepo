import { config } from "../config/config.js";

const { bffUrl } = config;

/**
 * Builds a link for an e-service item.
 */
export function buildEserviceLink(
  eserviceId: string,
  descriptorId: string
): string {
  return `${bffUrl}/emailDeepLink/eserviceCatalog?entityId=${eserviceId}/${descriptorId}`;
}

/**
 * Builds a link for an e-service template item.
 */
export function buildEserviceTemplateLink(
  eserviceTemplateId: string,
  eserviceTemplateVersionId: string
): string {
  return `${bffUrl}/emailDeepLink/eserviceTemplateToCreator?entityId=${eserviceTemplateId}/${eserviceTemplateVersionId}`;
}

/**
 * Builds a link for an agreement item.
 *
 * @param isProducerView - true if the link is for the producer (received agreements), false for consumer (sent agreements)
 */
export function buildAgreementLink(
  agreementId: string,
  isProducerView: boolean
): string {
  const notificationType = isProducerView
    ? "agreementToProducer"
    : "agreementToConsumer";
  return `${bffUrl}/emailDeepLink/${notificationType}?entityId=${agreementId}`;
}

// "View all" links for digest email sections
export const viewAllNewEservicesLink = `${bffUrl}/emailDeepLink/eserviceCatalog`;
export const viewAllUpdatedEservicesLink = `${bffUrl}/emailDeepLink/eserviceCatalog`;
export const viewAllSentAgreementsLink = `${bffUrl}/emailDeepLink/agreementToConsumer`;
export const viewAllSentPurposesLink = `${bffUrl}/emailDeepLink/purposeToConsumer`;
export const viewAllReceivedAgreementsLink = `${bffUrl}/emailDeepLink/agreementToProducer`;
export const viewAllReceivedPurposesLink = `${bffUrl}/emailDeepLink/purposeToProducer`;
export const viewAllDelegationsLink = `${bffUrl}/emailDeepLink/delegation`;
export const viewAllAttributesLink = `${bffUrl}/emailDeepLink/attribute`;
export const viewAllUpdatedEserviceTemplatesLink = `${bffUrl}/emailDeepLink/eserviceTemplateToCreator`;
export const viewAllPopularEserviceTemplatesLink = `${bffUrl}/emailDeepLink/eserviceTemplateToInstantiator`;
