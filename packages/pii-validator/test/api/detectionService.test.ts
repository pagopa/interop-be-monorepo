import { describe, expect, it } from "vitest";

import { detectionService } from "../../src/services/detectionService.js";

async function categories(text: string) {
  const response = await detectionService.detect({
    fields: [{ fieldId: "example", text }],
  });
  return response.results[0].detectedCategories;
}

describe("deterministic detection", () => {
  it("detects an email in prose and returns only detected categories", async () => {
    expect(await categories("Scrivi a qa@example.com, per favore.")).toEqual([
      "EMAIL_ADDRESS",
    ]);
  });

  it("returns no categories for neutral or empty prose", async () => {
    expect(await categories("Testo sintetico neutro.")).toEqual([]);
    expect(await categories("")).toEqual([]);
  });

  it.each([
    ["EMAIL_ADDRESS", "contatto: qa@example.com, grazie"],
    ["EMAIL_ADDRESS", "contatto: qa@example.com/alt"],
    ["EMAIL_ADDRESS", "contatto: qa@example.com/"],
    ["EMAIL_ADDRESS", "qa@example.com/alt help@sample.it"],
    ["PHONE_NUMBER", "cellulare 3494096457"],
    ["PHONE_NUMBER", "cellulare +39 3494096457"],
    ["IT_VAT_CODE", "partita IVA IT12345678901."],
    ["IT_VAT_CODE", "partita IVA 12345678901."],
    ["IBAN_CODE", "IBAN IT60X0542811101000000123456"],
    ["CREDIT_CARD", "carta 4111111111111111."],
  ] as const)("recognizes %s within a description", async (category, text) => {
    expect(await categories(text)).toContain(category);
  });

  it("aggregates independent categories without a global first match", async () => {
    expect(
      await categories(
        "qa@example.com RSSMRA80A01H501U IT60X0542811101000000123456"
      )
    ).toEqual(["EMAIL_ADDRESS", "IBAN_CODE"]);
  });

  it("does not classify a valid card prefix inside a longer digit sequence", async () => {
    expect(await categories("4111 1111 1111 1111 2222")).not.toContain(
      "CREDIT_CARD"
    );
  });

  it("does not classify a valid mobile prefix inside a longer digit sequence", async () => {
    expect(await categories("333 1234567 999")).not.toContain("PHONE_NUMBER");
  });

  it("preserves batch order, identity and independent verdicts", async () => {
    expect(
      await detectionService.detect({
        fields: [
          { fieldId: "email", text: "qa@example.com" },
          { fieldId: "empty", text: "" },
          { fieldId: "card", text: "4111111111111111" },
        ],
      })
    ).toEqual({
      results: [
        { fieldId: "email", detectedCategories: ["EMAIL_ADDRESS"] },
        { fieldId: "empty", detectedCategories: [] },
        { fieldId: "card", detectedCategories: ["CREDIT_CARD"] },
      ],
    });
  });

  it.each([
    ["EMAIL_ADDRESS", "qa@ example.com"],
    ["IT_FISCAL_CODE", "RSSMRA80A01H501U"],
    ["IBAN_CODE", "IT60 X054 2811 1010 0000 0123 456"],
    ["IBAN_CODE", "IT60-X054-2811-1010-0000-0123-456"],
    ["PHONE_NUMBER", "+39-3494096457"],
    ["CREDIT_CARD", "4111 1111 1111 1111 2222"],
    ["IT_FISCAL_CODE", "RSSMRA80A01H501Z"],
    ["IT_FISCAL_CODE", "RSSMRA80 A01H501U"],
    ["IT_VAT_CODE", "IT 1234567890A"],
    ["IBAN_CODE", "DE89370400440532013000"],
    ["IBAN_CODE", "IT60 X054 2811 1010 0000 0123 4567"],
    ["CREDIT_CARD", "4111 1111 1111 1112"],
    ["PHONE_NUMBER", "telefono fisso 0612345678"],
    ["IT_IDENTITY_CARD", "CA12345AA"],
  ] as const)("rejects %s for nonmatching input", async (category, text) => {
    expect(await categories(text)).not.toContain(category);
  });
});
