import { generateId } from "pagopa-interop-models";

import { TenantDigestData } from "../src/services/digestDataService.js";

const CARDS_LIMIT = 6;
const LISTS_LIMIT = 5;

/**
 * Returns mock eservices data with the specified number of items
 */
function generateNewEservices(
  itemsNumber: number,
  isTemplate: boolean = false
): TenantDigestData["newEservices"] {
  const items = Array.from(
    { length: itemsNumber > CARDS_LIMIT ? CARDS_LIMIT : itemsNumber },
    (_, index) => ({
      name: `Servizio ${index + 1}`,
      producerName: `Ente ${index + 1}`,
      link: `https://example.com/eservice${isTemplate ? "-template" : ""}/${index + 1}`,
    })
  );
  return {
    items,
    totalCount: itemsNumber,
  };
}

/**
 * Returns mock digest data for agreements or purposes with the specified number of items
 */
function generateAgreementOrPurposeItems(
  itemsNumber: number,
  type: "agreement" | "purpose"
): TenantDigestData["acceptedSentAgreements"] {
  const items = Array.from(
    { length: itemsNumber > LISTS_LIMIT ? LISTS_LIMIT : itemsNumber },
    (_, index) => ({
      name: `${type === "agreement" ? "Richiesta" : "Finalità"} ${index + 1}`,
      producerName: `Ente ${index + 1}`,
      link: `https://example.com/${type}/${index + 1}`,
    })
  );
  return {
    items,
    totalCount: itemsNumber,
  };
}

/**
 * Returns mock digest data for received purposes with the specified number of items
 */
function generateReceivedPurposes(
  itemsNumber: number
): TenantDigestData["publishedReceivedPurposes"] {
  const items = Array.from(
    { length: itemsNumber > LISTS_LIMIT ? LISTS_LIMIT : itemsNumber },
    (_, index) => ({
      name: `Finalità Ricevuta ${index + 1}`,
      producerName: `Ente ${index + 1}`,
      link: `https://example.com/purpose/${index + 1}`,
      consumerName: `Ente Consumatore ${index + 1}`,
    })
  );
  return {
    items,
    totalCount: itemsNumber,
  };
}

/**
 * Returns mock digest data for received delegations with the specified number of items
 */
function generateReceivedDelegations(
  itemsNumber: number
): TenantDigestData["waitingForApprovalReceivedDelegations"] {
  const items = Array.from(
    { length: itemsNumber > LISTS_LIMIT ? LISTS_LIMIT : itemsNumber },
    (_, index) => ({
      name: `Delega in Attesa ${index + 1}`,
      producerName: `Ente Richiedente Delega ${index + 1}`,
      link: `https://example.com/delegation/${index + 1}`,
      delegationKind: (index % 2 === 0 ? "erogazione" : "fruizione") as
        | "erogazione"
        | "fruizione",
    })
  );
  return {
    items,
    totalCount: itemsNumber,
  };
}

/**
 * Returns mock digest data for Attributes with the specified number of items
 */
function generateAttributes(
  itemsNumber: number
): TenantDigestData["receivedAttributes"] {
  const items = Array.from(
    { length: itemsNumber > LISTS_LIMIT ? LISTS_LIMIT : itemsNumber },
    (_, index) => ({
      name: `Attributo ${index + 1}`,
      producerName: `Ente ${index + 1}`,
      link: `https://example.com/attribute/${index + 1}`,
      attributeKind:
        index % 2 === 0
          ? "certified"
          : ("verified" as "certified" | "verified"),
      attributeKindLabel: index % 2 === 0 ? "(certificato)" : "(verificato)",
    })
  );
  return {
    items,
    totalCount: itemsNumber,
  };
}

/**
 * Returns mock digest data with all sections populated (full data)
 */
export function getMockTenantDigestData(): TenantDigestData {
  return {
    tenantId: generateId(),
    tenantName: "Mock Tenant Organization",
    notificationSettingsLink: "https://example.com/notification-settings",
    viewAllNewEservicesLink: "https://example.com/eservices/new",
    viewAllUpdatedEservicesLink: "https://example.com/eservices/updated",
    viewAllSentAgreementsLink: "https://example.com/agreements/sent",
    viewAllSentPurposesLink: "https://example.com/purposes/sent",
    viewAllReceivedAgreementsLink: "https://example.com/agreements/received",
    viewAllReceivedPurposesLink: "https://example.com/purposes/received",
    viewAllReceivedDelegationsLink: "https://example.com/delegations/received",
    viewAllAttributesLink: "https://example.com/attributes",
    viewAllUpdatedEserviceTemplatesLink:
      "https://example.com/eservice-templates/updated",
    newEservices: generateNewEservices(8),
    updatedEservices: generateNewEservices(9),
    updatedEserviceTemplates: generateNewEservices(10, true),
    acceptedSentAgreements: generateAgreementOrPurposeItems(7, "agreement"),
    rejectedSentAgreements: generateAgreementOrPurposeItems(8, "agreement"),
    suspendedSentAgreements: generateAgreementOrPurposeItems(9, "agreement"),
    publishedSentPurposes: generateAgreementOrPurposeItems(10, "purpose"),
    rejectedSentPurposes: generateAgreementOrPurposeItems(11, "purpose"),
    waitingForApprovalSentPurposes: generateAgreementOrPurposeItems(
      12,
      "purpose"
    ),
    waitingForApprovalReceivedAgreements: generateAgreementOrPurposeItems(
      7,
      "agreement"
    ),
    publishedReceivedPurposes: generateReceivedPurposes(8),
    waitingForApprovalReceivedPurposes: generateReceivedPurposes(9),
    waitingForApprovalReceivedDelegations: generateReceivedDelegations(10),
    revokedReceivedDelegations: generateReceivedDelegations(11),
    receivedAttributes: generateAttributes(12),
    revokedAttributes: generateAttributes(13),
  };
}

/**
 * Returns mock digest data with all sections populated but no extra data (limited data)
 */
export function getMockLimitedTenantDigestData(): TenantDigestData {
  return {
    tenantId: generateId(),
    tenantName: "Mock Tenant Organization",
    notificationSettingsLink: "https://example.com/notification-settings",
    viewAllNewEservicesLink: "https://example.com/eservices/new",
    viewAllUpdatedEservicesLink: "https://example.com/eservices/updated",
    viewAllSentAgreementsLink: "https://example.com/agreements/sent",
    viewAllSentPurposesLink: "https://example.com/purposes/sent",
    viewAllReceivedAgreementsLink: "https://example.com/agreements/received",
    viewAllReceivedPurposesLink: "https://example.com/purposes/received",
    viewAllReceivedDelegationsLink: "https://example.com/delegations/received",
    viewAllAttributesLink: "https://example.com/attributes",
    viewAllUpdatedEserviceTemplatesLink:
      "https://example.com/eservice-templates/updated",
    newEservices: generateNewEservices(6),
    updatedEservices: generateNewEservices(6),
    updatedEserviceTemplates: generateNewEservices(6, true),
    acceptedSentAgreements: generateAgreementOrPurposeItems(5, "agreement"),
    rejectedSentAgreements: generateAgreementOrPurposeItems(5, "agreement"),
    suspendedSentAgreements: generateAgreementOrPurposeItems(5, "agreement"),
    publishedSentPurposes: generateAgreementOrPurposeItems(5, "purpose"),
    rejectedSentPurposes: generateAgreementOrPurposeItems(5, "purpose"),
    waitingForApprovalSentPurposes: generateAgreementOrPurposeItems(
      5,
      "purpose"
    ),
    waitingForApprovalReceivedAgreements: generateAgreementOrPurposeItems(
      5,
      "agreement"
    ),
    publishedReceivedPurposes: generateReceivedPurposes(5),
    waitingForApprovalReceivedPurposes: generateReceivedPurposes(5),
    waitingForApprovalReceivedDelegations: generateReceivedDelegations(5),
    revokedReceivedDelegations: generateReceivedDelegations(5),
    receivedAttributes: generateAttributes(5),
    revokedAttributes: generateAttributes(5),
  };
}

/**
 * Returns mock digest data with only one item per sections populated (Singular Data)
 */
export function getMockSingularTenantDigestData(): TenantDigestData {
  return {
    tenantId: generateId(),
    tenantName: "Mock Tenant Organization",
    notificationSettingsLink: "https://example.com/notification-settings",
    viewAllNewEservicesLink: "https://example.com/eservices/new",
    viewAllUpdatedEservicesLink: "https://example.com/eservices/updated",
    viewAllSentAgreementsLink: "https://example.com/agreements/sent",
    viewAllSentPurposesLink: "https://example.com/purposes/sent",
    viewAllReceivedAgreementsLink: "https://example.com/agreements/received",
    viewAllReceivedPurposesLink: "https://example.com/purposes/received",
    viewAllReceivedDelegationsLink: "https://example.com/delegations/received",
    viewAllAttributesLink: "https://example.com/attributes",
    viewAllUpdatedEserviceTemplatesLink:
      "https://example.com/eservice-templates/updated",
    newEservices: generateNewEservices(1),
    updatedEservices: generateNewEservices(1),
    updatedEserviceTemplates: generateNewEservices(1, true),
    acceptedSentAgreements: generateAgreementOrPurposeItems(1, "agreement"),
    rejectedSentAgreements: generateAgreementOrPurposeItems(1, "agreement"),
    suspendedSentAgreements: generateAgreementOrPurposeItems(1, "agreement"),
    publishedSentPurposes: generateAgreementOrPurposeItems(1, "purpose"),
    rejectedSentPurposes: generateAgreementOrPurposeItems(1, "purpose"),
    waitingForApprovalSentPurposes: generateAgreementOrPurposeItems(
      1,
      "purpose"
    ),
    waitingForApprovalReceivedAgreements: generateAgreementOrPurposeItems(
      1,
      "agreement"
    ),
    publishedReceivedPurposes: generateReceivedPurposes(1),
    waitingForApprovalReceivedPurposes: generateReceivedPurposes(1),
    waitingForApprovalReceivedDelegations: generateReceivedDelegations(1),
    revokedReceivedDelegations: generateReceivedDelegations(1),
    receivedAttributes: generateAttributes(1),
    revokedAttributes: generateAttributes(1),
  };
}

/**
 * Returns mock digest data with only E-services and Attributes sections populated
 * Used to verify that only populated section groups are rendered
 */
export function getMockPartialDigestData(): TenantDigestData {
  return {
    tenantId: generateId(),
    tenantName: "Mock Tenant Organization",
    notificationSettingsLink: "https://example.com/notification-settings",
    viewAllNewEservicesLink: "https://example.com/eservices/new",
    viewAllUpdatedEservicesLink: "https://example.com/eservices/updated",
    viewAllSentAgreementsLink: "https://example.com/agreements/sent",
    viewAllSentPurposesLink: "https://example.com/purposes/sent",
    viewAllReceivedAgreementsLink: "https://example.com/agreements/received",
    viewAllReceivedPurposesLink: "https://example.com/purposes/received",
    viewAllReceivedDelegationsLink: "https://example.com/delegations/received",
    viewAllAttributesLink: "https://example.com/attributes",
    viewAllUpdatedEserviceTemplatesLink:
      "https://example.com/eservice-templates/updated",
    // E-services section - populated
    newEservices: generateNewEservices(2),
    updatedEservices: generateNewEservices(2),
    updatedEserviceTemplates: { items: [], totalCount: 0 },
    // Sent Items section - empty
    acceptedSentAgreements: { items: [], totalCount: 0 },
    rejectedSentAgreements: { items: [], totalCount: 0 },
    suspendedSentAgreements: { items: [], totalCount: 0 },
    publishedSentPurposes: { items: [], totalCount: 0 },
    rejectedSentPurposes: { items: [], totalCount: 0 },
    waitingForApprovalSentPurposes: {
      items: [],
      totalCount: 0,
    },
    // Received Items section - empty
    waitingForApprovalReceivedAgreements: {
      items: [],
      totalCount: 0,
    },
    publishedReceivedPurposes: { items: [], totalCount: 0 },
    waitingForApprovalReceivedPurposes: {
      items: [],
      totalCount: 0,
    },
    // Delegations section - empty
    waitingForApprovalReceivedDelegations: {
      items: [],
      totalCount: 0,
    },
    revokedReceivedDelegations: { items: [], totalCount: 0 },
    // Attributes section - populated
    receivedAttributes: generateAttributes(1),
    revokedAttributes: generateAttributes(1),
  };
}
