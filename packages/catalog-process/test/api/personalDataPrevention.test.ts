import { describe, expect, it, vi } from "vitest";

import { createPersonalDataPrevention } from "../../src/services/personalDataPrevention/index.js";

const request = {
  fields: [
    { fieldId: "summary", text: "Synthetic summary" },
    { fieldId: "notes", text: "Synthetic notes" },
  ],
};
const context = { correlationId: "synthetic-correlation" };
const accepted = {
  results: request.fields.map(({ fieldId }) => ({
    fieldId,
    detectedCategories: [],
  })),
};

describe("generic batch personal data prevention", () => {
  it("rejects a blocked category using an injected reusable policy", async () => {
    const transport = vi.fn().mockResolvedValue({
      results: [
        { fieldId: "summary", detectedCategories: ["EMAIL_ADDRESS"] },
        accepted.results[1],
      ],
    });
    await expect(
      createPersonalDataPrevention({
        transport,
        policy: () => true,
      }).assertAllowed(request, context)
    ).rejects.toMatchObject({
      code: "PERSONAL_DATA_REJECTED",
      message: "Personal data rejected",
    });
    await expect(
      createPersonalDataPrevention({
        transport,
        policy: () => false,
      }).assertAllowed(request, context)
    ).resolves.toBeUndefined();
  });

  it.each([
    { fields: [] },
    {
      fields: Array.from({ length: 11 }, (_, i) => ({
        fieldId: `field-${i}`,
        text: "Synthetic",
      })),
    },
    { fields: [request.fields[0], request.fields[0]] },
    { fields: [{ fieldId: "", text: "Synthetic" }] },
    { fields: [{ fieldId: "notes", text: 17 }] },
    { ...request, extra: "SYNTHETIC_PRIVATE" },
    { fields: [{ ...request.fields[0], extra: "SYNTHETIC_PRIVATE" }] },
  ])("rejects invalid input before transport: %j", async (input) => {
    const transport = vi.fn().mockResolvedValue(accepted);
    await expect(
      createPersonalDataPrevention({
        transport,
        policy: () => true,
      }).assertAllowed(input as typeof request, context)
    ).rejects.toMatchObject({ code: "PERSONAL_DATA_PREVENTION_UNAVAILABLE" });
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { results: [] },
    { results: [accepted.results[0]] },
    {
      results: [
        ...accepted.results,
        { fieldId: "extra", detectedCategories: [] },
      ],
    },
    { results: [...accepted.results].reverse() },
    {
      results: [
        { fieldId: "different", detectedCategories: [] },
        accepted.results[1],
      ],
    },
    { ...accepted, extra: "SYNTHETIC_PRIVATE" },
    {
      results: [
        { ...accepted.results[0], extra: "SYNTHETIC_PRIVATE" },
        accepted.results[1],
      ],
    },
    {
      results: [
        { fieldId: "summary", detectedCategories: ["UNKNOWN"] },
        accepted.results[1],
      ],
    },
    {
      results: [
        {
          fieldId: "summary",
          detectedCategories: ["EMAIL_ADDRESS", "EMAIL_ADDRESS"],
        },
        accepted.results[1],
      ],
    },
    {
      results: [
        { fieldId: "summary", detectedCategories: false },
        accepted.results[1],
      ],
    },
  ])("requires a complete strict ordered verdict: %j", async (response) => {
    const policy = vi.fn(() => true);
    const transport = vi.fn().mockResolvedValue(response);
    await expect(
      createPersonalDataPrevention({ transport, policy }).assertAllowed(
        request,
        context
      )
    ).rejects.toMatchObject({ code: "PERSONAL_DATA_PREVENTION_UNAVAILABLE" });
    expect(policy).not.toHaveBeenCalled();
  });

  it("requires no categories for empty text", async () => {
    const transport = vi.fn().mockResolvedValue({
      results: [{ fieldId: "notes", detectedCategories: ["EMAIL_ADDRESS"] }],
    });
    await expect(
      createPersonalDataPrevention({
        transport,
        policy: () => true,
      }).assertAllowed({ fields: [{ fieldId: "notes", text: "" }] }, context)
    ).rejects.toMatchObject({ code: "PERSONAL_DATA_PREVENTION_UNAVAILABLE" });
  });

  it.each(["transport", "policy", "parsing"])(
    "sanitizes %s exceptions without preserving raw causes",
    async (source) => {
      const sentinel = "SYNTHETIC_PRIVATE_EXCEPTION";
      const raw = Object.assign(
        new Error(sentinel, { cause: { token: sentinel } }),
        { text: sentinel }
      );
      const transport = vi.fn(async () => {
        if (source === "transport") {
          throw raw;
        }
        if (source === "parsing") {
          return {
            get results(): never {
              throw raw;
            },
          };
        }
        return {
          results: [
            { fieldId: "summary", detectedCategories: ["EMAIL_ADDRESS"] },
            accepted.results[1],
          ],
        };
      });
      const policy = (): boolean => {
        throw raw;
      };
      const error = await createPersonalDataPrevention({ transport, policy })
        .assertAllowed(request, context)
        .catch((caught: unknown) => caught);
      expect(error).toMatchObject({
        code: "PERSONAL_DATA_PREVENTION_UNAVAILABLE",
      });
      expect(error).not.toHaveProperty("cause");
      expect(
        JSON.stringify(Object.getOwnPropertyDescriptors(error))
      ).not.toContain(sentinel);
      expect(String(error)).not.toContain(sentinel);
    }
  );

  it("allows a complete two-field negative verdict and forwards context", async () => {
    const transport = vi.fn().mockResolvedValue(accepted);
    const prevention = createPersonalDataPrevention({
      transport,
      policy: () => false,
    });
    await expect(
      prevention.assertAllowed(request, context)
    ).resolves.toBeUndefined();
    expect(transport).toHaveBeenCalledExactlyOnceWith(request, context);
  });
});
