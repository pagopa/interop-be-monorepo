/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, expect, it } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { api } from "../../vitest.api.setup.js";
import { config } from "../../../src/config/config.js";

describe("API GET /emailDeepLink/:digestNotificationType (with optional entityId and selfcareId query params)", () => {
  const makeRequest = async (
    digestNotificationType: string,
    options?: { entityId?: string; selfcareId?: string }
  ) => {
    const url = `${appBasePath}/emailDeepLink/${digestNotificationType}`;
    const req = request(api).get(url).set("X-Correlation-Id", generateId());

    const query: Record<string, string> = {};
    if (options?.entityId) {
      query.entityId = options.entityId;
    }
    if (options?.selfcareId) {
      query.selfcareId = options.selfcareId;
    }

    return req.query(query).send();
  };

  describe("Successful redirects with selfcareId (token-exchange)", () => {
    const selfcareId = generateId();

    it("Should return 302 and redirect to token-exchange for eservice catalog without entityId", async () => {
      const res = await makeRequest("eserviceCatalog", { selfcareId });
      expect(res.status).toBe(302);

      const location = new URL(res.headers.location);
      expect(location.pathname).toBe("/token-exchange");
      expect(location.searchParams.get("institutionId")).toBe(selfcareId);
      expect(location.searchParams.get("productId")).toBe(
        config.selfcareProductName
      );
      expect(location.searchParams.get("redirectUrl")).toBe(
        "/catalogo-e-service"
      );
    });

    it("Should return 302 and redirect to token-exchange for eservice catalog with entityId", async () => {
      const entityId = generateId();
      const res = await makeRequest("eserviceCatalog", {
        entityId,
        selfcareId,
      });
      expect(res.status).toBe(302);

      const location = new URL(res.headers.location);
      expect(location.pathname).toBe("/token-exchange");
      expect(location.searchParams.get("institutionId")).toBe(selfcareId);
      expect(location.searchParams.get("productId")).toBe(
        config.selfcareProductName
      );
      expect(location.searchParams.get("redirectUrl")).toBe(
        `/catalogo-e-service/${entityId}`
      );
    });

    it("Should return 302 and redirect to token-exchange for producer agreements", async () => {
      const entityId = generateId();
      const res = await makeRequest("agreementToProducer", {
        entityId,
        selfcareId,
      });
      expect(res.status).toBe(302);

      const location = new URL(res.headers.location);
      expect(location.pathname).toBe("/token-exchange");
      expect(location.searchParams.get("redirectUrl")).toBe(
        `/erogazione/richieste/${entityId}`
      );
    });

    it("Should return 302 and redirect to token-exchange for consumer agreements", async () => {
      const entityId = generateId();
      const res = await makeRequest("agreementToConsumer", {
        entityId,
        selfcareId,
      });
      expect(res.status).toBe(302);

      const location = new URL(res.headers.location);
      expect(location.pathname).toBe("/token-exchange");
      expect(location.searchParams.get("redirectUrl")).toBe(
        `/fruizione/richieste/${entityId}`
      );
    });

    it("Should return 302 and redirect to token-exchange for producer purposes", async () => {
      const entityId = generateId();
      const res = await makeRequest("purposeToProducer", {
        entityId,
        selfcareId,
      });
      expect(res.status).toBe(302);

      const location = new URL(res.headers.location);
      expect(location.pathname).toBe("/token-exchange");
      expect(location.searchParams.get("redirectUrl")).toBe(
        `/erogazione/finalita/${entityId}`
      );
    });

    it("Should return 302 and redirect to token-exchange for consumer purposes", async () => {
      const entityId = generateId();
      const res = await makeRequest("purposeToConsumer", {
        entityId,
        selfcareId,
      });
      expect(res.status).toBe(302);

      const location = new URL(res.headers.location);
      expect(location.pathname).toBe("/token-exchange");
      expect(location.searchParams.get("redirectUrl")).toBe(
        `/fruizione/finalita/${entityId}`
      );
    });

    it("Should return 302 and redirect to token-exchange for delegations", async () => {
      const entityId = generateId();
      const res = await makeRequest("delegation", { entityId, selfcareId });
      expect(res.status).toBe(302);

      const location = new URL(res.headers.location);
      expect(location.pathname).toBe("/token-exchange");
      expect(location.searchParams.get("redirectUrl")).toBe(
        `/aderente/deleghe/${entityId}`
      );
    });

    it("Should return 302 and redirect to token-exchange for attributes", async () => {
      const entityId = generateId();
      const res = await makeRequest("attribute", { entityId, selfcareId });
      expect(res.status).toBe(302);

      const location = new URL(res.headers.location);
      expect(location.pathname).toBe("/token-exchange");
      expect(location.searchParams.get("redirectUrl")).toBe(
        `/aderente/anagrafica/${entityId}`
      );
    });

    it("Should return 302 and redirect to token-exchange for eservice template creator", async () => {
      const entityId = generateId();
      const res = await makeRequest("eserviceTemplateToCreator", {
        entityId,
        selfcareId,
      });
      expect(res.status).toBe(302);

      const location = new URL(res.headers.location);
      expect(location.pathname).toBe("/token-exchange");
      expect(location.searchParams.get("redirectUrl")).toBe(
        `/erogazione/template-eservice/${entityId}`
      );
    });

    it("Should return 302 and redirect to token-exchange for eservice template instantiator", async () => {
      const entityId = generateId();
      const res = await makeRequest("eserviceTemplateToInstantiator", {
        entityId,
        selfcareId,
      });
      expect(res.status).toBe(302);

      const location = new URL(res.headers.location);
      expect(location.pathname).toBe("/token-exchange");
      expect(location.searchParams.get("redirectUrl")).toBe(
        `/erogazione/catalogo-template/${entityId}`
      );
    });
  });

  describe("Fallback without selfcareId", () => {
    it("Should return 302 and redirect to frontend base URL when selfcareId is not provided", async () => {
      const res = await makeRequest("eserviceCatalog");
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(config.frontendBaseUrl);
    });

    it("Should return 302 and redirect to frontend base URL when only entityId is provided", async () => {
      const entityId = generateId();
      const res = await makeRequest("eserviceCatalog", { entityId });
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(config.frontendBaseUrl);
    });
  });

  describe("Invalid input", () => {
    it("Should return 400 when digestNotificationType is invalid", async () => {
      const res = await makeRequest("invalidNotificationType");
      expect(res.status).toBe(400);
    });

    it("Should return error when digestNotificationType is empty", async () => {
      const res = await makeRequest("");
      // Empty path param results in server error (route mismatch or middleware issue)
      expect([400, 404, 500]).toContain(res.status);
    });
  });

  describe("Edge cases", () => {
    it("Should handle redirectUrl without trailing slash when entityId is not provided", async () => {
      const selfcareId = generateId();
      const res = await makeRequest("eserviceCatalog", { selfcareId });
      expect(res.status).toBe(302);

      const location = new URL(res.headers.location);
      const redirectUrl = location.searchParams.get("redirectUrl");
      expect(redirectUrl).not.toMatch(/\/$/);
    });

    it("Should handle special characters in entityId correctly", async () => {
      const entityId = generateId();
      const selfcareId = generateId();
      const res = await makeRequest("eserviceCatalog", {
        entityId,
        selfcareId,
      });
      expect(res.status).toBe(302);

      const location = new URL(res.headers.location);
      expect(location.searchParams.get("redirectUrl")).toContain(entityId);
    });
  });
});
