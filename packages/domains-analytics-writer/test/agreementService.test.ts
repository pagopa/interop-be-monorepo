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
  agreementItemFromDomain,
  getMockAgreement,
} from "./utils.js";

describe("Agreement Service - Batch Operations", () => {
  beforeEach(async () => {
    await resetAgreementTables(dbContext);
  });

  describe("Upsert", () => {
    it("inserts a complete Agreement with all subobjects", async () => {
      await agreementService.upsertBatchAgreement([agreementItem], dbContext);

      const storedAgreement = await getAgreementFromDb(
        agreementItem.agreementSQL.id,
        dbContext,
      );
      expect(storedAgreement).toBeDefined();
      expect(storedAgreement.metadata_version).toBe(1);

      const stamps = await getAgreementStampFromDb(
        agreementItem.stampsSQL[0].agreementId,
        dbContext,
      );
      expect(stamps.length).toBeGreaterThan(0);

      const attrs = await getAgreementAttributeFromDb(
        agreementItem.attributesSQL[0].attributeId,
        dbContext,
      );
      expect(attrs.length).toBeGreaterThan(0);

      const docs = await getAgreementConsumerDocumentFromDb(
        agreementItem.consumerDocumentsSQL[0].id,
        dbContext,
      );
      expect(docs.length).toBeGreaterThan(0);

      if (agreementItem.contractSQL?.id) {
        const contract = await getAgreementContractFromDb(
          agreementItem.contractSQL.id,
          dbContext,
        );
        expect(contract.length).toBe(1);
      }
    });
    it("keeps only record with highest metadata_version for the same agreement ID", async () => {
      const base = getMockAgreement();
      const older = { ...base, metadataVersion: 1 };
      const newer = { ...base, metadataVersion: 10 };

      const olderItem = agreementItemFromDomain(older);
      const newerItem = agreementItemFromDomain(newer);

      await agreementService.upsertBatchAgreement(
        [olderItem, newerItem],
        dbContext,
      );

      const stored = await getAgreementFromDb(base.id, dbContext);
      expect(stored.metadata_version).toBe(10);
    });

    it("inserts all agreements when IDs differ", async () => {
      const a1 = getMockAgreement();
      const a2 = getMockAgreement();
      const a3 = getMockAgreement();

      const items = [
        agreementItemFromDomain(a1),
        agreementItemFromDomain(a2),
        agreementItemFromDomain(a3),
      ];

      await agreementService.upsertBatchAgreement(items, dbContext);

      const storedA1 = await getAgreementFromDb(a1.id, dbContext);
      const storedA2 = await getAgreementFromDb(a2.id, dbContext);
      const storedA3 = await getAgreementFromDb(a3.id, dbContext);

      [storedA1, storedA2, storedA3].forEach((row) =>
        expect(row).toBeDefined(),
      );
      expect([storedA1.id, storedA2.id, storedA3.id]).toEqual(
        expect.arrayContaining([a1.id, a2.id, a3.id]),
      );
    });
  });

  describe("Delete", () => {
    it("marks an Agreement and all its sub-objects as deleted", async () => {
      await agreementService.upsertBatchAgreement([agreementItem], dbContext);
      await agreementService.deleteBatchAgreement(
        [agreementItem.agreementSQL.id as unknown as AgreementId],
        dbContext,
      );

      const storedAgreement = await getAgreementFromDb(
        agreementItem.agreementSQL.id,
        dbContext,
      );
      expect(storedAgreement.deleted).toBe(true);

      const storedStamps = await getAgreementStampFromDb(
        agreementItem.agreementSQL.id,
        dbContext,
      );
      storedStamps.forEach((s: { deleted: boolean }) =>
        expect(s.deleted).toBe(true),
      );

      const storedAttrs = await getAgreementAttributeFromDb(
        agreementItem.attributesSQL[0].attributeId,
        dbContext,
      );
      storedAttrs.forEach((a: { deleted: boolean }) =>
        expect(a.deleted).toBe(true),
      );

      const storedDocs = await getAgreementConsumerDocumentFromDb(
        agreementItem.consumerDocumentsSQL[0].id,
        dbContext,
      );
      storedDocs.forEach((d: { deleted: boolean }) =>
        expect(d.deleted).toBe(true),
      );
      if (agreementItem.contractSQL?.id) {
        const storedContract = await getAgreementContractFromDb(
          agreementItem.contractSQL.id,
          dbContext,
        );
        storedContract.forEach((c: { deleted: boolean }) =>
          expect(c.deleted).toBe(true),
        );
      }
    });

    it("marks a consumer-document as deleted", async () => {
      await agreementService.upsertBatchAgreement([agreementItem], dbContext);
      const docId = agreementItem.consumerDocumentsSQL[0].id;
      await agreementService.deleteBatchAgreementDocument([docId], dbContext);

      const docs = await getAgreementConsumerDocumentFromDb(docId, dbContext);
      docs.forEach((doc) => expect(doc.deleted).toBe(true));
    });
  });
});
