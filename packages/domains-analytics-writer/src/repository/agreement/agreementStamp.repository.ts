import { ITask, IMain } from "pg-promise";
import { genericInternalError } from "pagopa-interop-models";
import { AgreementStampSQL } from "pagopa-interop-readmodel-models";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import { AgreementDbTable } from "../../model/db.js";
import { agreementStampSchema } from "../../model/agreement/agreementStamp.js";

export function agreementStampRepo(conn: DBConnection) {
  const schema = config.dbSchemaName;
  const tbl = AgreementDbTable.agreement_stamp;
  const stage = `${tbl}${config.mergeTableSuffix}`;

  return {
    async insert(t: ITask<unknown>, pgp: IMain, records: AgreementStampSQL[]) {
      const mapping = {
        agreement_id: (r: AgreementStampSQL) => r.agreementId,
        metadata_version: (r: AgreementStampSQL) => r.metadataVersion,
        who: (r: AgreementStampSQL) => r.who,
        delegation_id: (r: AgreementStampSQL) => r.delegationId,
        when: (r: AgreementStampSQL) => r.when,
        kind: (r: AgreementStampSQL) => r.kind,
      };
      const cs = buildColumnSet<AgreementStampSQL>(pgp, mapping, stage);
      try {
        if (records.length) {
          await t.none(pgp.helpers.insert(records, cs));
          await t.none(`
            DELETE FROM ${stage} a
            USING ${stage} b
            WHERE a.agreement_id = b.agreement_id AND a.kind = b.kind
              AND a.metadata_version < b.metadata_version;
          `);
        }
      } catch (e) {
        throw genericInternalError(`stage stamps: ${e}`);
      }
    },

    async merge(t: ITask<unknown>) {
      try {
        await t.none(
          generateMergeQuery(
            agreementStampSchema,
            schema,
            tbl,
            stage,
            "agreement_id"
          )
        );
      } catch (e) {
        throw genericInternalError(`merge stamps: ${e}`);
      }
    },

    async cleanStage() {
      try {
        await conn.none(`TRUNCATE TABLE ${stage};`);
      } catch (e) {
        throw genericInternalError(`clean stamp stage: ${e}`);
      }
    },
  };
}
export type AgreementStampRepo = ReturnType<typeof agreementStampRepo>;
