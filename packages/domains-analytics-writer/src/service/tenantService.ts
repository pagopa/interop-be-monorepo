/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable sonarjs/cognitive-complexity */
import { genericLogger } from "pagopa-interop-commons";
import { DBContext } from "../db/db.js";
import { config } from "../config/config.js";
import { batchMessages } from "../utils/batchHelper.js";
import {
  cleaningTargetTables,
  mergeDeletingCascadeById,
} from "../utils/sqlQueryHelper.js";
import { tenantRepository } from "../repository/tenant/tenant.repository.js";
import { DeletingDbTable, TenantDbTable } from "../model/db/index.js";
import { tenantMailRepository } from "../repository/tenant/tenantMail.repository.js";
import { tenantCertifiedAttributeRepository } from "../repository/tenant/tenantCertifiedAttribute.repository.js";
import { tenantDeclaredAttributeRepository } from "../repository/tenant/tenantDeclaredAttribute.repository.js";
import { tenantVerifiedAttributeRepository } from "../repository/tenant/tenantVerifiedAttribute.repository.js";
import { tenantVerifiedAttributeRevokerRepository } from "../repository/tenant/tenantVerifiedAttributeRevoker.repository.js";
import { tenantVerifiedAttributeVerifierRepository } from "../repository/tenant/tenantVerifiedAttributeVerifier.repository.js";
import { tenantFeatureRepository } from "../repository/tenant/tenantFeature.repository.js";
import {
  TenantItemsSchema,
  TenantSelfcareIdSchema,
  TenantDeletingSchema,
} from "../model/tenant/tenant.js";
import { TenantMailDeletingSchema } from "../model/tenant/tenantMail.js";

export function tenantServiceBuilder(db: DBContext) {
  const tenantRepo = tenantRepository(db.conn);
  const tenantMailRepo = tenantMailRepository(db.conn);
  const tenantCertifiedAttributeRepo = tenantCertifiedAttributeRepository(
    db.conn
  );
  const tenantDeclaredAttributeRepo = tenantDeclaredAttributeRepository(
    db.conn
  );
  const tenantVerifiedAttributeRepo = tenantVerifiedAttributeRepository(
    db.conn
  );
  const tenantVerifiedAttributeVerifierRepo =
    tenantVerifiedAttributeVerifierRepository(db.conn);
  const tenantVerifiedAttributeRevokerRepo =
    tenantVerifiedAttributeRevokerRepository(db.conn);
  const tenantFeatureRepo = tenantFeatureRepository(db.conn);

  return {
    async upsertBatchTenantItems(
      items: TenantItemsSchema[],
      dbContext: DBContext
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          const batchItems = {
            tenantSQL: batch.map((item) => item.tenantSQL),
            mailsSQL: batch.flatMap((item) => item.mailsSQL),
            certifiedAttributesSQL: batch.flatMap(
              (item) => item.certifiedAttributesSQL
            ),
            declaredAttributesSQL: batch.flatMap(
              (item) => item.declaredAttributesSQL
            ),
            verifiedAttributesSQL: batch.flatMap(
              (item) => item.verifiedAttributesSQL
            ),
            verifiedAttributeVerifiersSQL: batch.flatMap(
              (item) => item.verifiedAttributeVerifiersSQL
            ),
            verifiedAttributeRevokersSQL: batch.flatMap(
              (item) => item.verifiedAttributeRevokersSQL
            ),
            featuresSQL: batch.flatMap((item) => item.featuresSQL),
          };

          if (batchItems.tenantSQL.length) {
            await tenantRepo.insert(t, dbContext.pgp, batchItems.tenantSQL);
          }
          if (batchItems.mailsSQL.length) {
            await tenantMailRepo.insert(t, dbContext.pgp, batchItems.mailsSQL);
          }
          if (batchItems.certifiedAttributesSQL.length) {
            await tenantCertifiedAttributeRepo.insert(
              t,
              dbContext.pgp,
              batchItems.certifiedAttributesSQL
            );
          }
          if (batchItems.declaredAttributesSQL.length) {
            await tenantDeclaredAttributeRepo.insert(
              t,
              dbContext.pgp,
              batchItems.declaredAttributesSQL
            );
          }
          if (batchItems.verifiedAttributesSQL.length) {
            await tenantVerifiedAttributeRepo.insert(
              t,
              dbContext.pgp,
              batchItems.verifiedAttributesSQL
            );
          }
          if (batchItems.verifiedAttributeVerifiersSQL.length) {
            await tenantVerifiedAttributeVerifierRepo.insert(
              t,
              dbContext.pgp,
              batchItems.verifiedAttributeVerifiersSQL
            );
          }
          if (batchItems.verifiedAttributeRevokersSQL.length) {
            await tenantVerifiedAttributeRevokerRepo.insert(
              t,
              dbContext.pgp,
              batchItems.verifiedAttributeRevokersSQL
            );
          }
          if (batchItems.featuresSQL.length) {
            await tenantFeatureRepo.insert(
              t,
              dbContext.pgp,
              batchItems.featuresSQL
            );
          }

          genericLogger.info(
            `Staging inserted for Tenant batch: ${batchItems.tenantSQL
              .map((r) => r.id)
              .join(", ")}`
          );
        }

        await tenantRepo.merge(t);
        await tenantMailRepo.merge(t);
        await tenantCertifiedAttributeRepo.merge(t);
        await tenantDeclaredAttributeRepo.merge(t);
        await tenantVerifiedAttributeRepo.merge(t);
        await tenantVerifiedAttributeVerifierRepo.merge(t);
        await tenantVerifiedAttributeRevokerRepo.merge(t);
        await tenantFeatureRepo.merge(t);
      });

      await dbContext.conn.tx(async (t) => {
        await cleaningTargetTables(
          t,
          "tenantId",
          [
            TenantDbTable.tenant_mail,
            TenantDbTable.tenant_certified_attribute,
            TenantDbTable.tenant_declared_attribute,
            TenantDbTable.tenant_verified_attribute,
            TenantDbTable.tenant_verified_attribute_verifier,
            TenantDbTable.tenant_verified_attribute_revoker,
            TenantDbTable.tenant_feature,
          ],
          TenantDbTable.tenant
        );
      });

      genericLogger.info(`Staging data merged into target tables for Tenant`);

      await tenantRepo.clean();
      await tenantMailRepo.clean();
      await tenantCertifiedAttributeRepo.clean();
      await tenantDeclaredAttributeRepo.clean();
      await tenantVerifiedAttributeRepo.clean();
      await tenantVerifiedAttributeVerifierRepo.clean();
      await tenantVerifiedAttributeRevokerRepo.clean();
      await tenantFeatureRepo.clean();

      genericLogger.info(`Staging tables cleaned for Tenant batches`);
    },

    async upsertBatchTenantSelfCareIdItems(
      items: TenantSelfcareIdSchema[],
      dbContext: DBContext
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await tenantRepo.insertTenantSelfcareId(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging data inserted for TenantSelfcareId batch: ${batch
              .map((r) => r.id)
              .join(", ")}`
          );
        }

        await tenantRepo.mergeTenantSelfcareId(t);
      });

      genericLogger.info(
        `Staging data merged into target tables for TenantSelfcareId`
      );

      await tenantRepo.clean();
      genericLogger.info(`Staging table cleaned for TenantSelfcareId`);
    },

    async deleteBatchTenants(
      records: TenantDeletingSchema[],
      dbContext: DBContext
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          records,
          config.dbMessagesToInsertPerBatch
        )) {
          await tenantRepo.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for Tenant batch: ${batch
              .map((r) => r.id)
              .join(", ")}`
          );
        }

        await tenantRepo.mergeDeleting(t);
        await mergeDeletingCascadeById(
          t,
          "tenantId",
          [
            TenantDbTable.tenant_mail,
            TenantDbTable.tenant_certified_attribute,
            TenantDbTable.tenant_declared_attribute,
            TenantDbTable.tenant_verified_attribute,
            TenantDbTable.tenant_verified_attribute_verifier,
            TenantDbTable.tenant_verified_attribute_revoker,
            TenantDbTable.tenant_feature,
          ],
          DeletingDbTable.tenant_deleting_table
        );
      });

      await tenantRepo.cleanDeleting();
      genericLogger.info(`Staging deletion table cleaned for Tenant`);
    },

    async deleteBatchTenantMails(
      mailIds: TenantMailDeletingSchema[],
      dbContext: DBContext
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          mailIds,
          config.dbMessagesToInsertPerBatch
        )) {
          await tenantMailRepo.insertDeleting(t, dbContext.pgp, batch);
          genericLogger.info(
            `Staging deletion inserted for TenantMail batch: ${batch
              .map((r) => r.id)
              .join(", ")}`
          );
        }

        await tenantMailRepo.mergeDeleting(t);
      });

      genericLogger.info(
        `Staging deletion merged into target tables for TenantMail`
      );

      await tenantRepo.cleanDeleting();
      genericLogger.info(`Staging deletion table cleaned for TenantMail`);
    },
  };
}
