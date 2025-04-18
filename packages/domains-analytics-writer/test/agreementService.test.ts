/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from "vitest";
import { AgreementId } from "pagopa-interop-models";
import {
  dbContext,
  agreementService,
  resetAgreementTables,
  agreementItem,
  getAgreementFromDb,
  getAgreementStampFromDb,
  getAgreementAttributeFromDb,
  getAgreementConsumerDocumentFromDb,
  getAgreementContractFromDb,
} from "./utils.js";

describe("Agreement Service – Batch Operations", () => {
  beforeEach(async () => {
    await resetAgreementTables(dbContext);
  });

  describe("Upsert", () => {
    it("inserts a complete Agreement with all sub‑objects", async () => {
      await agreementService.upsertBatchAgreement([agreementItem], dbContext);

      const storedAgreement = await getAgreementFromDb(
        agreementItem.agreementSQL.id,
        dbContext
      );
      expect(storedAgreement).toBeDefined();
      expect(storedAgreement.metadata_version).toBe(1);

      const stamps = await getAgreementStampFromDb(
        agreementItem.stampsSQL[0].agreementId,
        dbContext
      );
      expect(stamps.length).toBeGreaterThan(0);

      const attrs = await getAgreementAttributeFromDb(
        agreementItem.attributesSQL[0].attributeId,
        dbContext
      );
      expect(attrs.length).toBeGreaterThan(0);

      const docs = await getAgreementConsumerDocumentFromDb(
        agreementItem.consumerDocumentsSQL[0].id,
        dbContext
      );
      expect(docs.length).toBeGreaterThan(0);

      const contract = await getAgreementContractFromDb(
        agreementItem.contractSQL!.id,
        dbContext
      );
      expect(contract.length).toBe(1);
    });
  });

  /* ---------------------- DELETE -------------------------------- */
  describe("Delete", () => {
    it("marks an Agreement and sub‑objects as deleted", async () => {
      await agreementService.upsertBatchAgreement([agreementItem], dbContext);
      await agreementService.deleteBatchAgreement(
        [agreementItem.agreementSQL.id as unknown as AgreementId],
        dbContext
      );

      const stored = await getAgreementFromDb(
        agreementItem.agreementSQL.id,
        dbContext
      );
      expect(stored.deleted).toBe(true);

      (await getAgreementStampFromDb(stored.id, dbContext)).forEach((s) =>
        expect(s.deleted).toBe(true)
      );
      (
        await getAgreementAttributeFromDb(
          agreementItem.attributesSQL[0].attributeId,
          dbContext
        )
      ).forEach((a) => expect(a.deleted).toBe(true));
      (
        await getAgreementConsumerDocumentFromDb(
          agreementItem.consumerDocumentsSQL[0].id,
          dbContext
        )
      ).forEach((d) => expect(d.deleted).toBe(true));
      (
        await getAgreementContractFromDb(
          agreementItem.contractSQL!.id,
          dbContext
        )
      ).forEach((c) => expect(c.deleted).toBe(true));
    });

    it("marks a consumer‑document as deleted", async () => {
      await agreementService.upsertBatchAgreement([agreementItem], dbContext);
      const docId = agreementItem.consumerDocumentsSQL[0].id;
      await agreementService.deleteBatchAgreementDocument([docId], dbContext);

      const docs = await getAgreementConsumerDocumentFromDb(docId, dbContext);
      expect(docs[0].deleted).toBe(true);
    });
  });
});
