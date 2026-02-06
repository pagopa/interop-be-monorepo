import { config } from "../config/config.js";

const { bffUrl } = config;

const DEEPLINK_BASE_PATH = "/emailDeepLink";

/**
 * Builds a deeplink URL with optional query parameters.
 */
function buildDeeplinkUrl(
  notificationType: string,
  params?: { entityId?: string; selfcareId?: string | null }
): string {
  const url = new URL(`${DEEPLINK_BASE_PATH}/${notificationType}`, bffUrl);

  if (params?.entityId) {
    url.searchParams.set("entityId", params.entityId);
  }
  if (params?.selfcareId) {
    url.searchParams.set("selfcareId", params.selfcareId);
  }

  return url.href;
}

/**
 * Builds a link for an e-service item.
 */
export function buildEserviceLink(
  eserviceId: string,
  descriptorId: string,
  selfcareId: string | null
): string {
  return buildDeeplinkUrl("eserviceCatalog", {
    entityId: `${eserviceId}/${descriptorId}`,
    selfcareId,
  });
}

/**
 * Builds a link for an e-service template item (for instantiator).
 */
export function buildEserviceTemplateLinkToInstantiator(
  eserviceTemplateId: string,
  eserviceTemplateVersionId: string,
  selfcareId: string | null
): string {
  return buildDeeplinkUrl("eserviceTemplateToInstantiator", {
    entityId: `${eserviceTemplateId}/${eserviceTemplateVersionId}`,
    selfcareId,
  });
}

/**
 * Builds a link for an e-service template item (for creator).
 */
export function buildEserviceTemplateLinkToCreator(
  eserviceTemplateId: string,
  eserviceTemplateVersionId: string,
  selfcareId: string | null
): string {
  return buildDeeplinkUrl("eserviceTemplateToCreator", {
    entityId: `${eserviceTemplateId}/${eserviceTemplateVersionId}`,
    selfcareId,
  });
}

/**
 * Builds a link for an agreement item.
 *
 * @param isProducerView - true if the link is for the producer (received agreements), false for consumer (sent agreements)
 */
export function buildAgreementLink(
  agreementId: string,
  isProducerView: boolean,
  selfcareId: string | null
): string {
  const notificationType = isProducerView
    ? "agreementToProducer"
    : "agreementToConsumer";
  return buildDeeplinkUrl(notificationType, {
    entityId: agreementId,
    selfcareId,
  });
}

/**
 * Builds a link for a purpose item.
 *
 * @param isProducerView - true if the link is for the producer (received purposes), false for consumer (sent purposes)
 */
export function buildPurposeLink(
  purposeId: string,
  isProducerView: boolean,
  selfcareId: string | null
): string {
  const notificationType = isProducerView
    ? "purposeToProducer"
    : "purposeToConsumer";
  return buildDeeplinkUrl(notificationType, {
    entityId: purposeId,
    selfcareId,
  });
}

/**
 * Builds a link for a delegation item.
 */
export function buildDelegationLink(selfcareId: string | null): string {
  return buildDeeplinkUrl("delegation", { selfcareId });
}

// "View all" link builders for digest email sections
export function viewAllNewUpdatedEservicesLink(
  selfcareId: string | null
): string {
  return buildDeeplinkUrl("eserviceCatalog", { selfcareId });
}

export function viewAllSentAgreementsLink(selfcareId: string | null): string {
  return buildDeeplinkUrl("agreementToConsumer", { selfcareId });
}

export function viewAllSentPurposesLink(selfcareId: string | null): string {
  return buildDeeplinkUrl("purposeToConsumer", { selfcareId });
}

export function viewAllReceivedAgreementsLink(
  selfcareId: string | null
): string {
  return buildDeeplinkUrl("agreementToProducer", { selfcareId });
}

export function viewAllReceivedPurposesLink(selfcareId: string | null): string {
  return buildDeeplinkUrl("purposeToProducer", { selfcareId });
}

export function viewAllSentDelegationsLink(selfcareId: string | null): string {
  return buildDeeplinkUrl("delegationToDelegator", { selfcareId });
}

export function viewAllReceivedDelegationsLink(
  selfcareId: string | null
): string {
  return buildDeeplinkUrl("delegationToDelegate", { selfcareId });
}

export function viewAllAttributesLink(selfcareId: string | null): string {
  return buildDeeplinkUrl("attribute", { selfcareId });
}

export function viewAllUpdatedEserviceTemplatesLink(
  selfcareId: string | null
): string {
  return buildDeeplinkUrl("eserviceTemplateToCreator", { selfcareId });
}

export function viewAllPopularEserviceTemplatesLink(
  selfcareId: string | null
): string {
  return buildDeeplinkUrl("eserviceTemplateToInstantiator", { selfcareId });
}

export function notificationSettingsLink(selfcareId: string | null): string {
  return buildDeeplinkUrl("notificationSettings", { selfcareId });
}
