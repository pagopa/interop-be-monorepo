/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { genericLogger } from "pagopa-interop-commons";
import {
  TenantFeatureSQL,
  TenantItemsSQL,
  TenantMailSQL,
  TenantSQL,
} from "pagopa-interop-readmodel-models";
import { DBContext } from "../db/db.js";
import { config } from "../config/config.js";
import { batchMessages } from "../utils/batchHelper.js";
import { mergeDeletingCascadeById } from "../utils/sqlQueryHelper.js";
import { tenantRepository } from "../repository/tenant/tenant.repository.js";
import { DeletingDbTable, TenantDbTable } from "../model/db.js";
import { tenantMailRepository } from "../repository/tenant/tenantMail.repository.js";
import { tenantCertifiedAttributeRepository } from "../repository/tenant/tenantCertifiedAttribute.repository.js";
import { tenantDeclaredAttributeRepository } from "../repository/tenant/tenantDeclaredAttribute.repository.js";
import { tenantVerifiedAttributeRepository } from "../repository/tenant/tenantVerifiedAttribute.repository.js";
import { tenantVerifiedAttributeRevokerRepository } from "../repository/tenant/tenantVerifiedAttributeRevoker.repository.js";
import { tenantVerifiedAttributeVerifierRepository } from "../repository/tenant/tenantVerifiedAttributeVerifier.repository.js";
import { tenantFeatureRepository } from "../repository/tenant/tenantFeature.repository.js";

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
      items: TenantItemsSQL[],
      dbContext: DBContext
    ) {
      for (const batch of batchMessages(
        items,
        config.dbMessagesToInsertPerBatch
      )) {
        const batchItems = {
          tenantSQL: batch.map((item) => item.tenantSQL),
          mailsSQL: batch.map((item) => item.mailsSQL).flat(),
          certifiedAttributesSQL: batch
            .map((item) => item.certifiedAttributesSQL)
            .flat(),
          declaredAttributesSQL: batch
            .map((item) => item.declaredAttributesSQL)
            .flat(),
          verifiedAttributesSQL: batch
            .map((item) => item.verifiedAttributesSQL)
            .flat(),
          verifiedAttributeVerifiersSQL: batch
            .map((item) => item.verifiedAttributeVerifiersSQL)
            .flat(),
          verifiedAttributeRevokersSQL: batch
            .map((item) => item.verifiedAttributeRevokersSQL)
            .flat(),
          featuresSQL: batch.map((item) => item.featuresSQL).flat(),
        };

        await dbContext.conn.tx(async (t) => {
          if (batchItems.tenantSQL.length) {
            await tenantRepo.insert(t, dbContext.pgp, batchItems.tenantSQL);
            await tenantMailRepo.insert(t, dbContext.pgp, batchItems.mailsSQL);
            await tenantCertifiedAttributeRepo.insert(
              t,
              dbContext.pgp,
              batchItems.certifiedAttributesSQL
            );
            await tenantDeclaredAttributeRepo.insert(
              t,
              dbContext.pgp,
              batchItems.declaredAttributesSQL
            );
            await tenantVerifiedAttributeRepo.insert(
              t,
              dbContext.pgp,
              batchItems.verifiedAttributesSQL
            );
            await tenantVerifiedAttributeVerifierRepo.insert(
              t,
              dbContext.pgp,
              batchItems.verifiedAttributeVerifiersSQL
            );
            await tenantVerifiedAttributeRevokerRepo.insert(
              t,
              dbContext.pgp,
              batchItems.verifiedAttributeRevokersSQL
            );
            await tenantFeatureRepo.insert(
              t,
              dbContext.pgp,
              batchItems.featuresSQL
            );
          }
        });

        genericLogger.info(
          `Staging data inserted for tenant batch of ${batchItems.tenantSQL.length}`
        );
      }

      await dbContext.conn.tx(async (t) => {
        await tenantRepo.merge(t);
        await tenantMailRepo.merge(t);
        await tenantCertifiedAttributeRepo.merge(t);
        await tenantDeclaredAttributeRepo.merge(t);
        await tenantVerifiedAttributeRepo.merge(t);
        await tenantVerifiedAttributeVerifierRepo.merge(t);
        await tenantVerifiedAttributeRevokerRepo.merge(t);
        await tenantFeatureRepo.merge(t);
      });

      genericLogger.info(
        `Staging data merged into target tables for all tenant batches`
      );

      await tenantRepo.clean();
      await tenantMailRepo.clean();
      await tenantCertifiedAttributeRepo.clean();
      await tenantDeclaredAttributeRepo.clean();
      await tenantVerifiedAttributeRepo.clean();
      await tenantVerifiedAttributeVerifierRepo.clean();
      await tenantVerifiedAttributeRevokerRepo.clean();
      await tenantFeatureRepo.clean();

      genericLogger.info(`Cleaned all tenant staging data`);
    },

    async setBatchTenantSelfCareIdItems(
      items: Array<Pick<TenantSQL, "id" | "selfcareId" | "metadataVersion">>,
      dbContext: DBContext
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          items,
          config.dbMessagesToInsertPerBatch
        )) {
          await tenantRepo.insertTenantSelfcareId(t, dbContext.pgp, batch);

          genericLogger.info(
            `Staging data inserted for tenant batch of ${batch.length}`
          );
        }
      });

      await tenantRepo.mergeTenantSelfcareId();

      genericLogger.info(
        `Staging data merged into target tables for all tenant batches`
      );

      await tenantRepo.clean();

      genericLogger.info(`Cleaned all tenant staging data`);
    },

    async deleteBatchTenants(
      tenantIds: Array<TenantSQL["id"]>,
      dbContext: DBContext
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          tenantIds,
          config.dbMessagesToInsertPerBatch
        )) {
          await tenantRepo.insertDeleting(t, dbContext.pgp, batch);
        }
      });

      await dbContext.conn.tx(async (t) => {
        await tenantRepo.mergeDeleting(t);
        await mergeDeletingCascadeById(
          t,
          "tenant_id",
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

      genericLogger.info(
        `Staging deletion merged into target tables for all tenantIds`
      );

      await tenantRepo.cleanDeleting();

      genericLogger.info(`Staging tenant table cleaned`);
    },

    async deleteBatchTenantMailsByTenantId(
      records: Array<Pick<TenantMailSQL, "id" | "tenantId">>,
      dbContext: DBContext
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          records,
          config.dbMessagesToInsertPerBatch
        )) {
          await tenantMailRepo.insertDeletingByMailIdAndTenantId(
            t,
            dbContext.pgp,
            batch
          );

          genericLogger.info(
            `Staging deletion inserted for tenant mails by tenantId: ${batch.join(
              ", "
            )}`
          );
        }
      });

      await tenantMailRepo.mergeDeletingByMailIdAndTenantId();

      genericLogger.info(
        `Staging deletion merged into target tables for tenant mails by tenantId`
      );

      await tenantRepo.cleanDeleting();

      genericLogger.info(
        `Staging deletion cleaned for tenant mails by tenantId`
      );
    },

    async deleteBatchTenantMails(
      mailIds: Array<TenantMailSQL["id"]>,
      dbContext: DBContext
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          mailIds,
          config.dbMessagesToInsertPerBatch
        )) {
          await tenantMailRepo.insertDeleting(t, dbContext.pgp, batch);

          genericLogger.info(
            `Staging deletion inserted tenant mails: ${batch.join(", ")}`
          );
        }
      });

      await tenantMailRepo.mergeDeleting();

      genericLogger.info(
        `Staging deletion merged into target tables for tenant mails`
      );

      await tenantRepo.cleanDeleting();

      genericLogger.info(`Staging deletion cleaned for tenant mails`);
    },

    async deleteBatchTenantFeatures(
      features: Array<Pick<TenantFeatureSQL, "tenantId" | "kind">>,
      dbContext: DBContext
    ) {
      await dbContext.conn.tx(async (t) => {
        for (const batch of batchMessages(
          features,
          config.dbMessagesToInsertPerBatch
        )) {
          await tenantFeatureRepo.insertDeleting(t, dbContext.pgp, batch);

          genericLogger.info(
            `Staging deletion inserted tenant features: ${batch
              .map((r) => `(${r.tenantId}-${r.kind})`)
              .join(", ")}`
          );
        }
      });

      await tenantFeatureRepo.mergeDeleting();

      genericLogger.info(
        `Staging deletion merged into target tables for tenant features`
      );

      await tenantFeatureRepo.cleanDeleting();

      genericLogger.info(`Staging deletion cleaned for tenant features`);
    },
  };
}
