import { UserRole, userRole } from "pagopa-interop-models";
import { BaseDigest, TenantDigestData } from "../services/digestDataService.js";

/**
 * Keys of TenantDigestData whose values extend BaseDigest | undefined.
 * This excludes string metadata fields (tenantId, tenantName, links, etc.).
 */
type DigestDataField = {
  [K in keyof TenantDigestData]-?: TenantDigestData[K] extends
    | BaseDigest
    | undefined
    ? K
    : never;
}[keyof TenantDigestData];

const { ADMIN_ROLE, API_ROLE, SECURITY_ROLE, SUPPORT_ROLE } = userRole;

export type DigestSection =
  | "newEservices"
  | "updatedEservices"
  | "updatedEserviceTemplates"
  | "popularEserviceTemplates"
  | "sentAgreements"
  | "receivedAgreements"
  | "sentPurposes"
  | "receivedPurposes"
  | "delegations"
  | "attributes";

/**
 * Which roles can see each digest section.
 */
export const digestAdmittedRoles = {
  newEservices: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: true,
    [SECURITY_ROLE]: true,
    [SUPPORT_ROLE]: false,
  },
  updatedEservices: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: true,
    [SECURITY_ROLE]: true,
    [SUPPORT_ROLE]: false,
  },
  updatedEserviceTemplates: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: true,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
  },
  popularEserviceTemplates: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: true,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
  },
  sentAgreements: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: true,
    [SUPPORT_ROLE]: false,
  },
  receivedAgreements: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
  },
  sentPurposes: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: true,
    [SUPPORT_ROLE]: false,
  },
  receivedPurposes: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: true,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
  },
  delegations: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
  },
  attributes: {
    [ADMIN_ROLE]: true,
    [API_ROLE]: false,
    [SECURITY_ROLE]: false,
    [SUPPORT_ROLE]: false,
  },
} as const satisfies Record<DigestSection, Record<UserRole, boolean>> &
  Record<DigestSection, Record<typeof SUPPORT_ROLE, false>>;

const allSections = Object.keys(digestAdmittedRoles) as DigestSection[];

/**
 * For each role the user has, collects the sections that role can see,
 * then returns the union as a Record<DigestSection, boolean>.
 * All sections default to false.
 */
export function getVisibleSections(
  roles: UserRole[]
): Record<DigestSection, boolean> {
  const defaults = Object.fromEntries(
    allSections.map((s) => [s, false])
  ) as Record<DigestSection, boolean>;

  return roles.reduce(
    (visibility, role) =>
      allSections.reduce(
        (acc, section) => ({
          ...acc,
          ...(digestAdmittedRoles[section][role] ? { [section]: true } : {}),
        }),
        visibility
      ),
    defaults
  );
}

/**
 * Which TenantDigestData fields each section controls.
 * Used to check whether a section has data.
 */
const digestSectionFields: Record<DigestSection, DigestDataField[]> = {
  newEservices: ["newEservices"],
  updatedEservices: ["updatedEservices"],
  updatedEserviceTemplates: ["updatedEserviceTemplates"],
  popularEserviceTemplates: ["popularEserviceTemplates"],
  sentAgreements: [
    "acceptedSentAgreements",
    "rejectedSentAgreements",
    "suspendedSentAgreements",
  ],
  receivedAgreements: ["waitingForApprovalReceivedAgreements"],
  sentPurposes: [
    "publishedSentPurposes",
    "rejectedSentPurposes",
    "waitingForApprovalSentPurposes",
  ],
  receivedPurposes: [
    "publishedReceivedPurposes",
    "waitingForApprovalReceivedPurposes",
  ],
  delegations: [
    "activeSentDelegations",
    "rejectedSentDelegations",
    "waitingForApprovalReceivedDelegations",
    "revokedReceivedDelegations",
  ],
  attributes: ["receivedAttributes", "revokedAttributes"],
};

/**
 * Returns true if a section has data (at least one field with totalCount > 0).
 */
function sectionHasContent(
  data: TenantDigestData,
  section: DigestSection
): boolean {
  return digestSectionFields[section].some((field) => data[field]?.totalCount);
}

/**
 * Returns true if the tenant has data in at least one section
 * that is visible for the user's roles.
 */
export function hasVisibleDigestContent(
  data: TenantDigestData,
  visibility: Record<DigestSection, boolean>
): boolean {
  return allSections.some(
    (section) => visibility[section] && sectionHasContent(data, section)
  );
}

/**
 * Which sections belong to each template group.
 * A group is shown when at least one of its sections is visible AND has data.
 */
const digestGroups: Record<string, DigestSection[]> = {
  hasEservicesContent: [
    "newEservices",
    "updatedEservices",
    "updatedEserviceTemplates",
    "popularEserviceTemplates",
  ],
  hasSentItemsContent: ["sentAgreements", "sentPurposes"],
  hasReceivedItemsContent: ["receivedAgreements", "receivedPurposes"],
  hasDelegationsContent: ["delegations"],
  hasAttributesContent: ["attributes"],
};

/**
 * Computes group-level flags for the template.
 * A group is shown when at least one of its sections is visible AND has data.
 */
export function computeGroupFlags(
  data: TenantDigestData,
  visibility: Record<DigestSection, boolean>
): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(digestGroups).map(([group, sections]) => [
      group,
      sections.some(
        (section) => visibility[section] && sectionHasContent(data, section)
      ),
    ])
  );
}
