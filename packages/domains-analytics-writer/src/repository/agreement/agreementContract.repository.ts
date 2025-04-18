import { ITask, IMain } from "pg-promise";
import { genericInternalError } from "pagopa-interop-models";
import { AgreementContractSQL } from "pagopa-interop-readmodel-models";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import { AgreementDbTable } from "../../model/db.js";
import { agreementContractSchema } from "../../model/agreement/agreementContract.js";

export function agreementContractRepo(conn: DBConnection) {
  const schema = config.dbSchemaName;
  const tbl = AgreementDbTable.agreement_contract;
  const stage = `${tbl}${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: AgreementContractSQL[]
    ) {
      const mapping = {
        id: (r: AgreementContractSQL) => r.id,
        agreement_id: (r: AgreementContractSQL) => r.agreementId,
        metadata_version: (r: AgreementContractSQL) => r.metadataVersion,
        name: (r: AgreementContractSQL) => r.name,
        pretty_name: (r: AgreementContractSQL) => r.prettyName,
        content_type: (r: AgreementContractSQL) => r.contentType,
        path: (r: AgreementContractSQL) => r.path,
        created_at: (r: AgreementContractSQL) => r.createdAt,
      };
      const cs = buildColumnSet<AgreementContractSQL>(pgp, mapping, stage);
      try {
        if (records.length) {
          await t.none(pgp.helpers.insert(records, cs));
          await t.none(`
            DELETE FROM ${stage} a
            USING ${stage} b
            WHERE a.id = b.id AND a.metadata_version < b.metadata_version;
          `);
        }
      } catch (e) {
        throw genericInternalError(`stage contracts: ${e}`);
      }
    },

    async merge(t: ITask<unknown>) {
      try {
        await t.none(
          generateMergeQuery(agreementContractSchema, schema, tbl, stage, "id")
        );
      } catch (e) {
        throw genericInternalError(`merge contracts: ${e}`);
      }
    },

    async cleanStage() {
      try {
        await conn.none(`TRUNCATE TABLE ${stage};`);
      } catch (e) {
        throw genericInternalError(`clean contract stage: ${e}`);
      }
    },
  };
}
export type AgreementContractRepo = ReturnType<typeof agreementContractRepo>;
