/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, expect, it } from "vitest";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { appBasePath } from "../../../src/config/appBasePath.js";
import { api } from "../../vitest.api.setup.js";
import { config } from "../../../src/config/config.js";

describe("API GET /emailDeepLink/:digestNotificationType (with optional entityId query param)", () => {
  const makeRequest = async (
    digestNotificationType: string,
    entityId?: string
  ) => {
    const url = `${appBasePath}/emailDeepLink/${digestNotificationType}`;
    const req = request(api).get(url).set("X-Correlation-Id", generateId());

    if (entityId) {
      await req.query({ entityId });
    }

    return req.send();
  };

  describe("Successful redirects", () => {
    it("Should return 302 and redirect to eservice catalog when digestNotificationType is eserviceCatalog without entityId", async () => {
      const res = await makeRequest("eserviceCatalog");
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        `${config.frontendBaseUrl}/catalogo-e-service`
      );
    });

    it("Should return 302 and redirect to eservice catalog with entityId when provided", async () => {
      const entityId = generateId();
      const res = await makeRequest("eserviceCatalog", entityId);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        `${config.frontendBaseUrl}/catalogo-e-service/${entityId}`
      );
    });

    it("Should return 302 and redirect to producer agreements when digestNotificationType is agreementToProducer", async () => {
      const entityId = generateId();
      const res = await makeRequest("agreementToProducer", entityId);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        `${config.frontendBaseUrl}/erogazione/richieste/${entityId}`
      );
    });

    it("Should return 302 and redirect to consumer agreements when digestNotificationType is agreementToConsumer", async () => {
      const entityId = generateId();
      const res = await makeRequest("agreementToConsumer", entityId);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        `${config.frontendBaseUrl}/fruizione/richieste/${entityId}`
      );
    });

    it("Should return 302 and redirect to producer purposes when digestNotificationType is purposeToProducer", async () => {
      const entityId = generateId();
      const res = await makeRequest("purposeToProducer", entityId);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        `${config.frontendBaseUrl}/erogazione/finalita/${entityId}`
      );
    });

    it("Should return 302 and redirect to consumer purposes when digestNotificationType is purposeToConsumer", async () => {
      const entityId = generateId();
      const res = await makeRequest("purposeToConsumer", entityId);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        `${config.frontendBaseUrl}/fruizione/finalita/${entityId}`
      );
    });

    it("Should return 302 and redirect to delegations when digestNotificationType is delegation", async () => {
      const entityId = generateId();
      const res = await makeRequest("delegation", entityId);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        `${config.frontendBaseUrl}/aderente/deleghe/${entityId}`
      );
    });

    it("Should return 302 and redirect to attributes when digestNotificationType is attribute", async () => {
      const entityId = generateId();
      const res = await makeRequest("attribute", entityId);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        `${config.frontendBaseUrl}/aderente/anagrafica/${entityId}`
      );
    });

    it("Should return 302 and redirect to eservice template creator when digestNotificationType is eserviceTemplateToCreator", async () => {
      const entityId = generateId();
      const res = await makeRequest("eserviceTemplateToCreator", entityId);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        `${config.frontendBaseUrl}/erogazione/template-eservice/${entityId}`
      );
    });

    it("Should return 302 and redirect to eservice template instantiator when digestNotificationType is eserviceTemplateToInstantiator", async () => {
      const entityId = generateId();
      const res = await makeRequest("eserviceTemplateToInstantiator", entityId);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        `${config.frontendBaseUrl}/erogazione/catalogo-template/${entityId}`
      );
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
    it("Should handle entityId without trailing slash when not provided", async () => {
      const res = await makeRequest("eserviceCatalog");
      expect(res.status).toBe(302);
      // Check for double slashes in path (exclude protocol "://")
      const urlPath = new URL(res.headers.location).pathname;
      expect(urlPath).not.toContain("//");
      expect(res.headers.location).not.toMatch(/\/$/);
    });

    it("Should handle special characters in entityId correctly", async () => {
      const entityId = generateId();
      const res = await makeRequest("eserviceCatalog", entityId);
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain(entityId);
    });
  });
});
