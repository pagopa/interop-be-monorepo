import { describe, it, expect } from "vitest";
import {
  viewAllSentDelegationsLink,
  viewAllReceivedDelegationsLink,
} from "../src/services/deeplinkBuilder.js";

describe("deeplinkBuilder - delegation links", () => {
  const selfcareId = "test-selfcare-id";

  describe("viewAllSentDelegationsLink", () => {
    it("should include tab=delegationsGranted query param", () => {
      const url = new URL(viewAllSentDelegationsLink(selfcareId));
      expect(url.pathname).toBe("/emailDeepLink/delegation");
      expect(url.searchParams.get("tab")).toBe("delegationsGranted");
      expect(url.searchParams.get("selfcareId")).toBe(selfcareId);
    });

    it("should include tab=delegationsGranted when selfcareId is null", () => {
      const url = new URL(viewAllSentDelegationsLink(null));
      expect(url.pathname).toBe("/emailDeepLink/delegation");
      expect(url.searchParams.get("tab")).toBe("delegationsGranted");
      expect(url.searchParams.has("selfcareId")).toBe(false);
    });
  });

  describe("viewAllReceivedDelegationsLink", () => {
    it("should include tab=delegationsReceived query param", () => {
      const url = new URL(viewAllReceivedDelegationsLink(selfcareId));
      expect(url.pathname).toBe("/emailDeepLink/delegation");
      expect(url.searchParams.get("tab")).toBe("delegationsReceived");
      expect(url.searchParams.get("selfcareId")).toBe(selfcareId);
    });

    it("should include tab=delegationsReceived when selfcareId is null", () => {
      const url = new URL(viewAllReceivedDelegationsLink(null));
      expect(url.pathname).toBe("/emailDeepLink/delegation");
      expect(url.searchParams.get("tab")).toBe("delegationsReceived");
      expect(url.searchParams.has("selfcareId")).toBe(false);
    });
  });
});
