import { ContactId, generateId } from "pagopa-interop-models";
import { afterEach, describe, expect, it, vi } from "vitest";

import { tenantReadmodelReferenceCheckerBuilder } from "../src/tenantReadmodelReferenceChecker.js";
import { addTenant, readmodelDB } from "./utils.js";

const referenceChecker = tenantReadmodelReferenceCheckerBuilder(readmodelDB);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("tenantReadmodelReferenceChecker", () => {
  it("returns only the contacts of the page referenced by a tenant", async () => {
    const referencedId = generateId<ContactId>();
    const orphanId = generateId<ContactId>();
    const outsidePageId = generateId<ContactId>();
    await addTenant(referencedId);
    await addTenant(referencedId);
    await addTenant(outsidePageId);
    await addTenant();

    const referencedIds = await referenceChecker.findReferencedContactIds([
      referencedId,
      orphanId,
    ]);

    expect(referencedIds).toEqual(new Set([referencedId]));
  });

  it("returns no contact when no tenant references the page", async () => {
    await addTenant();
    await addTenant(generateId<ContactId>());

    const referencedIds = await referenceChecker.findReferencedContactIds([
      generateId<ContactId>(),
    ]);

    expect(referencedIds).toEqual(new Set());
  });

  it("fails when the tenant readmodel is empty", async () => {
    await expect(
      referenceChecker.findReferencedContactIds([generateId<ContactId>()])
    ).rejects.toThrow(
      "Tenant readmodel is empty: contact references cannot be verified"
    );
  });

  it("does not query the readmodel for an empty page", async () => {
    const select = vi.spyOn(readmodelDB, "select");
    const selectDistinct = vi.spyOn(readmodelDB, "selectDistinct");

    const referencedIds = await referenceChecker.findReferencedContactIds([]);

    expect(referencedIds).toEqual(new Set());
    expect(select).not.toHaveBeenCalled();
    expect(selectDistinct).not.toHaveBeenCalled();
  });
});
