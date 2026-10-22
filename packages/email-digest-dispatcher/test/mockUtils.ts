import { generateId } from "pagopa-interop-models";

import { TenantDigestData } from "../src/services/digestDataService.js";

const CARDS_LIMIT = 6;
const LISTS_LIMIT = 5;

/**
 * Returns mock eservices data with the specified number of items
 */
function generateNewEservices(
  itemsNumber: number,
  sectionLabel: string,
  isTemplate: boolean = false
): TenantDigestData["newEservices"] {
  const items = Array.from(
    { length: itemsNumber > CARDS_LIMIT ? CARDS_LIMIT : itemsNumber },
    (_, index) => ({
      name: `${sectionLabel} ${index + 1}`,
      producerName: `${sectionLabel} - Ente ${index + 1}`,
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
  type: "agreement" | "purpose",
  sectionLabel: string
): TenantDigestData["acceptedSentAgreements"] {
  const items = Array.from(
    { length: itemsNumber > LISTS_LIMIT ? LISTS_LIMIT : itemsNumber },
    (_, index) => ({
      name: `${sectionLabel} ${index + 1}`,
      producerName: `${sectionLabel} - Ente ${index + 1}`,
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
  itemsNumber: number,
  sectionLabel: string
): TenantDigestData["publishedReceivedPurposes"] {
  const items = Array.from(
    { length: itemsNumber > LISTS_LIMIT ? LISTS_LIMIT : itemsNumber },
    (_, index) => ({
      name: `${sectionLabel} ${index + 1}`,
      producerName: `${sectionLabel} - Ente ${index + 1}`,
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
  itemsNumber: number,
  sectionLabel: string
): TenantDigestData["waitingForApprovalReceivedDelegations"] {
  const items = Array.from(
    { length: itemsNumber > LISTS_LIMIT ? LISTS_LIMIT : itemsNumber },
    (_, index) => ({
      name: `${sectionLabel} ${index + 1}`,
      producerName: `${sectionLabel} - Ente Richiedente ${index + 1}`,
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
  itemsNumber: number,
  sectionLabel: string
): TenantDigestData["receivedAttributes"] {
  const items = Array.from(
    { length: itemsNumber > LISTS_LIMIT ? LISTS_LIMIT : itemsNumber },
    (_, index) => ({
      name: `${sectionLabel} ${index + 1}`,
      producerName: `${sectionLabel} - Ente ${index + 1}`,
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
    newEservices: generateNewEservices(8, "Nuovo e-service"),
    updatedEservices: generateNewEservices(9, "E-service aggiornato"),
    updatedEserviceTemplates: generateNewEservices(
      10,
      "Template aggiornato",
      true
    ),
    acceptedSentAgreements: generateAgreementOrPurposeItems(
      7,
      "agreement",
      "Richiesta approvata"
    ),
    rejectedSentAgreements: generateAgreementOrPurposeItems(
      8,
      "agreement",
      "Richiesta rifiutata"
    ),
    suspendedSentAgreements: generateAgreementOrPurposeItems(
      9,
      "agreement",
      "Richiesta sospesa"
    ),
    publishedSentPurposes: generateAgreementOrPurposeItems(
      10,
      "purpose",
      "Finalità pubblicata"
    ),
    rejectedSentPurposes: generateAgreementOrPurposeItems(
      11,
      "purpose",
      "Finalità rifiutata"
    ),
    waitingForApprovalSentPurposes: generateAgreementOrPurposeItems(
      12,
      "purpose",
      "Finalità in attesa di approvazione"
    ),
    waitingForApprovalReceivedAgreements: generateAgreementOrPurposeItems(
      7,
      "agreement",
      "Richiesta ricevuta"
    ),
    publishedReceivedPurposes: generateReceivedPurposes(8, "Finalità ricevuta"),
    waitingForApprovalReceivedPurposes: generateReceivedPurposes(
      9,
      "Finalità ricevuta in attesa"
    ),
    waitingForApprovalReceivedDelegations: generateReceivedDelegations(
      10,
      "Delega in attesa"
    ),
    revokedReceivedDelegations: generateReceivedDelegations(
      11,
      "Delega revocata"
    ),
    receivedAttributes: generateAttributes(12, "Attributo assegnato"),
    revokedAttributes: generateAttributes(13, "Attributo revocato"),
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
    newEservices: generateNewEservices(6, "Nuovo e-service"),
    updatedEservices: generateNewEservices(6, "E-service aggiornato"),
    updatedEserviceTemplates: generateNewEservices(
      6,
      "Template aggiornato",
      true
    ),
    acceptedSentAgreements: generateAgreementOrPurposeItems(
      5,
      "agreement",
      "Richiesta approvata"
    ),
    rejectedSentAgreements: generateAgreementOrPurposeItems(
      5,
      "agreement",
      "Richiesta rifiutata"
    ),
    suspendedSentAgreements: generateAgreementOrPurposeItems(
      5,
      "agreement",
      "Richiesta sospesa"
    ),
    publishedSentPurposes: generateAgreementOrPurposeItems(
      5,
      "purpose",
      "Finalità pubblicata"
    ),
    rejectedSentPurposes: generateAgreementOrPurposeItems(
      5,
      "purpose",
      "Finalità rifiutata"
    ),
    waitingForApprovalSentPurposes: generateAgreementOrPurposeItems(
      5,
      "purpose",
      "Finalità in attesa di approvazione"
    ),
    waitingForApprovalReceivedAgreements: generateAgreementOrPurposeItems(
      5,
      "agreement",
      "Richiesta ricevuta"
    ),
    publishedReceivedPurposes: generateReceivedPurposes(5, "Finalità ricevuta"),
    waitingForApprovalReceivedPurposes: generateReceivedPurposes(
      5,
      "Finalità ricevuta in attesa"
    ),
    waitingForApprovalReceivedDelegations: generateReceivedDelegations(
      5,
      "Delega in attesa"
    ),
    revokedReceivedDelegations: generateReceivedDelegations(
      5,
      "Delega revocata"
    ),
    receivedAttributes: generateAttributes(5, "Attributo assegnato"),
    revokedAttributes: generateAttributes(5, "Attributo revocato"),
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
    newEservices: generateNewEservices(1, "Nuovo e-service"),
    updatedEservices: generateNewEservices(1, "E-service aggiornato"),
    updatedEserviceTemplates: generateNewEservices(
      1,
      "Template aggiornato",
      true
    ),
    acceptedSentAgreements: generateAgreementOrPurposeItems(
      1,
      "agreement",
      "Richiesta approvata"
    ),
    rejectedSentAgreements: generateAgreementOrPurposeItems(
      1,
      "agreement",
      "Richiesta rifiutata"
    ),
    suspendedSentAgreements: generateAgreementOrPurposeItems(
      1,
      "agreement",
      "Richiesta sospesa"
    ),
    publishedSentPurposes: generateAgreementOrPurposeItems(
      1,
      "purpose",
      "Finalità pubblicata"
    ),
    rejectedSentPurposes: generateAgreementOrPurposeItems(
      1,
      "purpose",
      "Finalità rifiutata"
    ),
    waitingForApprovalSentPurposes: generateAgreementOrPurposeItems(
      1,
      "purpose",
      "Finalità in attesa di approvazione"
    ),
    waitingForApprovalReceivedAgreements: generateAgreementOrPurposeItems(
      1,
      "agreement",
      "Richiesta ricevuta"
    ),
    publishedReceivedPurposes: generateReceivedPurposes(1, "Finalità ricevuta"),
    waitingForApprovalReceivedPurposes: generateReceivedPurposes(
      1,
      "Finalità ricevuta in attesa"
    ),
    waitingForApprovalReceivedDelegations: generateReceivedDelegations(
      1,
      "Delega in attesa"
    ),
    revokedReceivedDelegations: generateReceivedDelegations(
      1,
      "Delega revocata"
    ),
    receivedAttributes: generateAttributes(1, "Attributo assegnato"),
    revokedAttributes: generateAttributes(1, "Attributo revocato"),
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
    newEservices: generateNewEservices(2, "Nuovo e-service"),
    updatedEservices: generateNewEservices(2, "E-service aggiornato"),
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
    receivedAttributes: generateAttributes(1, "Attributo assegnato"),
    revokedAttributes: generateAttributes(1, "Attributo revocato"),
  };
}
