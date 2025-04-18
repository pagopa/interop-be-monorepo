import { ITask, IMain } from "pg-promise";
import { genericInternalError } from "pagopa-interop-models";
import { AgreementAttributeSQL } from "pagopa-interop-readmodel-models";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import { AgreementDbTable } from "../../model/db.js";
import { agreementAttributeSchema } from "../../model/agreement/agreementAttribute.js";

export function agreementAttributeRepo(conn: DBConnection) {
  const schema = config.dbSchemaName;
  const tbl = AgreementDbTable.agreement_attribute;
  const stage = `${tbl}${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: AgreementAttributeSQL[]
    ) {
      const mapping = {
        agreement_id: (r: AgreementAttributeSQL) => r.agreementId,
        metadata_version: (r: AgreementAttributeSQL) => r.metadataVersion,
        attribute_id: (r: AgreementAttributeSQL) => r.attributeId,
        kind: (r: AgreementAttributeSQL) => r.kind,
      };
      const cs = buildColumnSet<AgreementAttributeSQL>(pgp, mapping, stage);
      try {
        if (records.length) {
          await t.none(pgp.helpers.insert(records, cs));
          await t.none(`
            DELETE FROM ${stage} a
            USING ${stage} b
            WHERE a.agreement_id = b.agreement_id AND a.attribute_id = b.attribute_id
              AND a.metadata_version < b.metadata_version;
          `);
        }
      } catch (e) {
        throw genericInternalError(`stage attrs: ${e}`);
      }
    },

    async merge(t: ITask<unknown>) {
      try {
        await t.none(
          generateMergeQuery(
            agreementAttributeSchema,
            schema,
            tbl,
            stage,
            "agreement_id"
          )
        );
      } catch (e) {
        throw genericInternalError(`merge attrs: ${e}`);
      }
    },

    async cleanStage() {
      try {
        await conn.none(`TRUNCATE TABLE ${stage};`);
      } catch (e) {
        throw genericInternalError(`clean attr stage: ${e}`);
      }
    },
  };
}
export type AgreementAttributeRepo = ReturnType<typeof agreementAttributeRepo>;
