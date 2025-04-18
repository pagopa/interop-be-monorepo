import { ITask, IMain } from "pg-promise";
import { genericInternalError } from "pagopa-interop-models";
import { AgreementSQL } from "pagopa-interop-readmodel-models";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import {
  generateMergeQuery,
  generateMergeDeleteQuery,
} from "../../utils/sqlQueryHelper.js";
import { AgreementDbTable, DeletingDbTable } from "../../model/db.js";
import { config } from "../../config/config.js";
import { agreementSchema } from "../../model/agreement/agreement.js";

export function agreementRepo(conn: DBConnection) {
  const schema = config.dbSchemaName;
  const tbl = AgreementDbTable.agreement;
  const stage = `${tbl}${config.mergeTableSuffix}`;
  const delStage = DeletingDbTable.agreement_deleting_table;

  return {
    async insert(t: ITask<unknown>, pgp: IMain, records: AgreementSQL[]) {
      const mapping = {
        id: (r: AgreementSQL) => r.id,
        metadata_version: (r: AgreementSQL) => r.metadataVersion,
        eservice_id: (r: AgreementSQL) => r.eserviceId,
        descriptor_id: (r: AgreementSQL) => r.descriptorId,
        producer_id: (r: AgreementSQL) => r.producerId,
        consumer_id: (r: AgreementSQL) => r.consumerId,
        state: (r: AgreementSQL) => r.state,
        suspended_by_consumer: (r: AgreementSQL) =>
          r.suspendedByConsumer ? "true" : "false",
        suspended_by_producer: (r: AgreementSQL) =>
          r.suspendedByProducer ? "true" : "false",
        suspended_by_platform: (r: AgreementSQL) =>
          r.suspendedByPlatform ? "true" : "false",
        created_at: (r: AgreementSQL) => r.createdAt,
        updated_at: (r: AgreementSQL) => r.updatedAt,
        consumer_notes: (r: AgreementSQL) => r.consumerNotes,
        rejection_reason: (r: AgreementSQL) => r.rejectionReason,
        suspended_at: (r: AgreementSQL) => r.suspendedAt,
      };
      const cs = buildColumnSet<AgreementSQL>(pgp, mapping, stage);
      try {
        if (records.length) {
          await t.none(pgp.helpers.insert(records, cs));
        }
        await t.none(`
          DELETE FROM ${stage} a
          USING ${stage} b
          WHERE a.id = b.id AND a.metadata_version < b.metadata_version;
        `);
      } catch (e) {
        throw genericInternalError(`stage agreements: ${e}`);
      }
    },

    async merge(t: ITask<unknown>) {
      try {
        await t.none(
          generateMergeQuery(agreementSchema, schema, tbl, stage, "id")
        );
      } catch (e) {
        throw genericInternalError(`merge agreements: ${e}`);
      }
    },

    async deleteStaged(t: ITask<unknown>, pgp: IMain, id: string) {
      try {
        const cs = buildColumnSet<{ id: string; deleted: boolean }>(
          pgp,
          { id: () => id, deleted: () => true },
          delStage
        );
        await t.none(
          pgp.helpers.insert({ id, deleted: true }, cs) +
            " ON CONFLICT DO NOTHING"
        );
      } catch (e) {
        throw genericInternalError(`stage del agreement: ${e}`);
      }
    },

    async mergeDeletes(t: ITask<unknown>) {
      try {
        await t.none(generateMergeDeleteQuery(schema, tbl, delStage, "id"));
      } catch (e) {
        throw genericInternalError(`merge del agreements: ${e}`);
      }
    },

    async cleanStage() {
      try {
        await conn.none(`TRUNCATE TABLE ${stage};`);
      } catch (e) {
        throw genericInternalError(`clean stage: ${e}`);
      }
    },
    async cleanDeleteStage() {
      try {
        await conn.none(`TRUNCATE TABLE ${delStage};`);
      } catch (e) {
        throw genericInternalError(`clean del stage: ${e}`);
      }
    },
  };
}
export type AgreementRepo = ReturnType<typeof agreementRepo>;
