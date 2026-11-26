import { catalogApi, piiValidatorApi } from "pagopa-interop-api-clients";
import { authRole } from "pagopa-interop-commons";
import {
  generateToken,
  getMockEService,
  getMockWithMetadata,
} from "pagopa-interop-commons-test";
import { generateId } from "pagopa-interop-models";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { eServiceToApiEService } from "../../src/model/domain/apiConverter.js";
import { assertDescriptionHasNoPii } from "../../src/services/piiDescriptionValidator.js";
import { api, catalogService } from "../vitest.api.setup.js";

const accepted = () => ({
  results: [{ fieldId: "description", detectedCategories: [] }],
});

describe("e-service description PII boundary (isolated)", () => {
  it("accepts a complete negative verdict for the selected description", async () => {
    const detectPii = vi.fn().mockResolvedValue(accepted());
    const description = "Synthetic service description";

    await expect(
      assertDescriptionHasNoPii(description, detectPii)
    ).resolves.toBeUndefined();
    expect(detectPii).toHaveBeenCalledExactlyOnceWith({
      fields: [{ fieldId: "description", text: description }],
    });
    expect(
      piiValidatorApi.DetectionResponse.safeParse(accepted()).success
    ).toBe(true);
  });

  it("rejects a detected category without exposing the supplied text", async () => {
    const description = "PRIVATE_SYNTHETIC_SENTINEL";
    const detectPii = vi.fn().mockResolvedValue({
      results: [
        { fieldId: "description", detectedCategories: ["EMAIL_ADDRESS"] },
      ],
    });

    let rejection: unknown;
    try {
      await assertDescriptionHasNoPii(description, detectPii);
    } catch (error) {
      rejection = error;
    }
    expect(rejection).toBeInstanceOf(Error);
    expect(detectPii).toHaveBeenCalledExactlyOnceWith({
      fields: [{ fieldId: "description", text: description }],
    });
    expect(JSON.stringify(rejection)).not.toContain(description);
    expect(String(rejection)).not.toContain(description);
  });

  it.each([
    ["missing results", {}],
    ["empty results", { results: [] }],
    [
      "missing selected field",
      { results: [{ fieldId: "other", detectedCategories: [] }] },
    ],
    [
      "extra field",
      {
        results: [
          ...accepted().results,
          { fieldId: "other", detectedCategories: [] },
        ],
      },
    ],
    ["missing categories", { results: [{ fieldId: "description" }] }],
    [
      "unknown category",
      {
        results: [{ fieldId: "description", detectedCategories: ["UNKNOWN"] }],
      },
    ],
    [
      "duplicate category",
      {
        results: [
          {
            fieldId: "description",
            detectedCategories: ["EMAIL_ADDRESS", "EMAIL_ADDRESS"],
          },
        ],
      },
    ],
    [
      "non-array categories",
      { results: [{ fieldId: "description", detectedCategories: false }] },
    ],
    [
      "extra result property",
      {
        results: [
          { ...accepted().results[0], text: "PRIVATE_SYNTHETIC_SENTINEL" },
        ],
      },
    ],
  ])("fails closed on %s", async (_case, response) => {
    const detectPii = vi.fn().mockResolvedValue(response);
    await expect(
      assertDescriptionHasNoPii("Synthetic service description", detectPii)
    ).rejects.toThrow("PII detection unavailable");
  });

  it("accepts an empty description under the batch contract", async () => {
    const detectPii = vi.fn().mockResolvedValue(accepted());
    await expect(
      assertDescriptionHasNoPii("", detectPii)
    ).resolves.toBeUndefined();
    expect(detectPii).toHaveBeenCalledExactlyOnceWith({
      fields: [{ fieldId: "description", text: "" }],
    });
  });

  it("fails closed when an empty description has detected categories", async () => {
    const detectPii = vi.fn().mockResolvedValue({
      results: [
        { fieldId: "description", detectedCategories: ["EMAIL_ADDRESS"] },
      ],
    });
    await expect(assertDescriptionHasNoPii("", detectPii)).rejects.toThrow(
      "PII detection unavailable"
    );
  });

  it("sanitizes a detector failure that includes the submitted text", async () => {
    const description = "PRIVATE_SYNTHETIC_SENTINEL";
    const detectPii = vi.fn().mockRejectedValue(new Error(description));
    let rejection: unknown;
    try {
      await assertDescriptionHasNoPii(description, detectPii);
    } catch (error) {
      rejection = error;
    }
    expect(rejection).toBeInstanceOf(Error);
    expect(String(rejection)).not.toContain(description);
    expect(JSON.stringify(rejection)).not.toContain(description);
  });

  it("the assembled catalog route retains its legacy behavior", async () => {
    const eservice = getMockEService();
    catalogService.updateEServiceDescription = vi
      .fn()
      .mockResolvedValue(getMockWithMetadata(eservice));
    const response = await request(api)
      .post(`/eservices/${eservice.id}/description/update`)
      .set("Authorization", `Bearer ${generateToken(authRole.ADMIN_ROLE)}`)
      .set("X-Correlation-Id", generateId())
      .send({ description: "Synthetic service description" });
    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      catalogApi.EService.parse(eServiceToApiEService(eservice))
    );
    expect(catalogService.updateEServiceDescription).toHaveBeenCalledOnce();
  });
});
