import { describe, it, expect } from "vitest";
import {
  getVisibleSections,
  hasVisibleDigestContent,
  digestAdmittedRoles,
  DigestSection,
} from "../src/utils/digestAdmittedRoles.js";
import { getMockTenantDigestData } from "./mockUtils.js";

describe("digestAdmittedRoles", () => {
  it("should have all sections deny support role", () => {
    for (const section of Object.keys(digestAdmittedRoles) as DigestSection[]) {
      expect(digestAdmittedRoles[section].support).toBe(false);
    }
  });
});

describe("getVisibleSections", () => {
  it("should enable all sections for admin role", () => {
    const visibility = getVisibleSections(["admin"]);

    expect(visibility.newEservices).toBe(true);
    expect(visibility.updatedEservices).toBe(true);
    expect(visibility.updatedEserviceTemplates).toBe(true);
    expect(visibility.popularEserviceTemplates).toBe(true);
    expect(visibility.sentAgreements).toBe(true);
    expect(visibility.receivedAgreements).toBe(true);
    expect(visibility.sentPurposes).toBe(true);
    expect(visibility.receivedPurposes).toBe(true);
    expect(visibility.delegations).toBe(true);
    expect(visibility.attributes).toBe(true);
  });

  it("should enable only eservices and received purposes for api role", () => {
    const visibility = getVisibleSections(["api"]);

    expect(visibility.newEservices).toBe(true);
    expect(visibility.updatedEservices).toBe(true);
    expect(visibility.updatedEserviceTemplates).toBe(true);
    expect(visibility.popularEserviceTemplates).toBe(true);
    expect(visibility.receivedPurposes).toBe(true);

    expect(visibility.sentAgreements).toBe(false);
    expect(visibility.receivedAgreements).toBe(false);
    expect(visibility.sentPurposes).toBe(false);
    expect(visibility.delegations).toBe(false);
    expect(visibility.attributes).toBe(false);
  });

  it("should enable eservices (no templates), sent agreements, and sent purposes for security role", () => {
    const visibility = getVisibleSections(["security"]);

    expect(visibility.newEservices).toBe(true);
    expect(visibility.updatedEservices).toBe(true);
    expect(visibility.sentAgreements).toBe(true);
    expect(visibility.sentPurposes).toBe(true);

    expect(visibility.updatedEserviceTemplates).toBe(false);
    expect(visibility.popularEserviceTemplates).toBe(false);
    expect(visibility.receivedAgreements).toBe(false);
    expect(visibility.receivedPurposes).toBe(false);
    expect(visibility.delegations).toBe(false);
    expect(visibility.attributes).toBe(false);
  });

  it("should disable all sections for support role", () => {
    const visibility = getVisibleSections(["support"]);

    for (const section of Object.keys(digestAdmittedRoles) as DigestSection[]) {
      expect(visibility[section]).toBe(false);
    }
  });

  it("should apply union of permissions for multi-role users", () => {
    const visibility = getVisibleSections(["api", "security"]);

    // From api: eservices (all 4), receivedPurposes
    // From security: newEservices, updatedEservices, sentAgreements, sentPurposes
    // Union: all 4 eservices + sentAgreements + sentPurposes + receivedPurposes
    expect(visibility.newEservices).toBe(true);
    expect(visibility.updatedEservices).toBe(true);
    expect(visibility.updatedEserviceTemplates).toBe(true);
    expect(visibility.popularEserviceTemplates).toBe(true);
    expect(visibility.sentAgreements).toBe(true);
    expect(visibility.sentPurposes).toBe(true);
    expect(visibility.receivedPurposes).toBe(true);

    // Still denied: receivedAgreements (admin only), delegations (admin only), attributes (admin only)
    expect(visibility.receivedAgreements).toBe(false);
    expect(visibility.delegations).toBe(false);
    expect(visibility.attributes).toBe(false);
  });

  it("should disable all sections for empty roles array", () => {
    const visibility = getVisibleSections([]);

    for (const section of Object.keys(digestAdmittedRoles) as DigestSection[]) {
      expect(visibility[section]).toBe(false);
    }
  });
});

describe("hasVisibleDigestContent", () => {
  const fullData = getMockTenantDigestData();

  it("should return true when admin has full data", () => {
    const visibility = getVisibleSections(["admin"]);
    expect(hasVisibleDigestContent(fullData, visibility)).toBe(true);
  });

  it("should return true when api role has data in visible sections", () => {
    const visibility = getVisibleSections(["api"]);
    expect(hasVisibleDigestContent(fullData, visibility)).toBe(true);
  });

  it("should return false when support role has no visible sections", () => {
    const visibility = getVisibleSections(["support"]);
    expect(hasVisibleDigestContent(fullData, visibility)).toBe(false);
  });

  it("should return false when all visible sections have no data", () => {
    const empty = { items: [], totalCount: 0 };
    const emptyData = {
      ...getMockTenantDigestData(),
      newEservices: empty,
      updatedEservices: empty,
      updatedEserviceTemplates: empty,
      popularEserviceTemplates: empty,
      publishedReceivedPurposes: empty,
      waitingForApprovalReceivedPurposes: empty,
    };

    const visibility = getVisibleSections(["api"]);
    expect(hasVisibleDigestContent(emptyData, visibility)).toBe(false);
  });

  it("should return false when data exists only in non-visible sections", () => {
    const empty = { items: [], totalCount: 0 };
    // Zero out everything except delegations
    const delegationsOnlyData = {
      ...getMockTenantDigestData(),
      newEservices: empty,
      updatedEservices: empty,
      updatedEserviceTemplates: empty,
      popularEserviceTemplates: empty,
      acceptedSentAgreements: empty,
      rejectedSentAgreements: empty,
      suspendedSentAgreements: empty,
      publishedSentPurposes: empty,
      rejectedSentPurposes: empty,
      waitingForApprovalSentPurposes: empty,
      waitingForApprovalReceivedAgreements: empty,
      publishedReceivedPurposes: empty,
      waitingForApprovalReceivedPurposes: empty,
      receivedAttributes: empty,
      revokedAttributes: empty,
      // delegations still have data from getMockTenantDigestData
    };

    // api role cannot see delegations
    const visibility = getVisibleSections(["api"]);
    expect(hasVisibleDigestContent(delegationsOnlyData, visibility)).toBe(
      false
    );
  });

  it("should return false when all sections are empty even if role allows them", () => {
    const empty = { items: [], totalCount: 0 };
    const allEmptyData = {
      ...getMockTenantDigestData(),
      newEservices: empty,
      updatedEservices: empty,
      updatedEserviceTemplates: empty,
      popularEserviceTemplates: empty,
      acceptedSentAgreements: empty,
      rejectedSentAgreements: empty,
      suspendedSentAgreements: empty,
      publishedSentPurposes: empty,
      rejectedSentPurposes: empty,
      waitingForApprovalSentPurposes: empty,
      waitingForApprovalReceivedAgreements: empty,
      publishedReceivedPurposes: empty,
      waitingForApprovalReceivedPurposes: empty,
      activeSentDelegations: empty,
      rejectedSentDelegations: empty,
      waitingForApprovalReceivedDelegations: empty,
      revokedReceivedDelegations: empty,
      receivedAttributes: empty,
      revokedAttributes: empty,
    };

    // Admin can see everything, but there's no data at all
    const visibility = getVisibleSections(["admin"]);
    expect(hasVisibleDigestContent(allEmptyData, visibility)).toBe(false);
  });

  it("should return false for empty roles array", () => {
    const visibility = getVisibleSections([]);
    expect(hasVisibleDigestContent(fullData, visibility)).toBe(false);
  });
});
