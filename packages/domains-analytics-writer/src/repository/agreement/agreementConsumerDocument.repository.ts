import { ITask, IMain } from "pg-promise";
import { genericInternalError } from "pagopa-interop-models";
import { AgreementConsumerDocumentSQL } from "pagopa-interop-readmodel-models";
import { DBConnection } from "../../db/db.js";
import { buildColumnSet } from "../../db/buildColumnSet.js";
import { generateMergeQuery } from "../../utils/sqlQueryHelper.js";
import { config } from "../../config/config.js";
import { AgreementDbTable } from "../../model/db.js";
import { agreementConsumerDocumentSchema } from "../../model/agreement/agreementConsumerDocument.js";

export function agreementConsumerDocumentRepo(conn: DBConnection) {
  const schema = config.dbSchemaName;
  const tbl = AgreementDbTable.agreement_consumer_document;
  const stage = `${tbl}${config.mergeTableSuffix}`;

  return {
    async insert(
      t: ITask<unknown>,
      pgp: IMain,
      records: AgreementConsumerDocumentSQL[]
    ) {
      const mapping = {
        id: (r: AgreementConsumerDocumentSQL) => r.id,
        agreement_id: (r: AgreementConsumerDocumentSQL) => r.agreementId,
        metadata_version: (r: AgreementConsumerDocumentSQL) =>
          r.metadataVersion,
        name: (r: AgreementConsumerDocumentSQL) => r.name,
        pretty_name: (r: AgreementConsumerDocumentSQL) => r.prettyName,
        content_type: (r: AgreementConsumerDocumentSQL) => r.contentType,
        path: (r: AgreementConsumerDocumentSQL) => r.path,
        created_at: (r: AgreementConsumerDocumentSQL) => r.createdAt,
      };
      const cs = buildColumnSet<AgreementConsumerDocumentSQL>(
        pgp,
        mapping,
        stage
      );
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
        throw genericInternalError(`stage docs: ${e}`);
      }
    },

    async merge(t: ITask<unknown>) {
      try {
        await t.none(
          generateMergeQuery(
            agreementConsumerDocumentSchema,
            schema,
            tbl,
            stage,
            "id"
          )
        );
      } catch (e) {
        throw genericInternalError(`merge docs: ${e}`);
      }
    },

    async delete(t: ITask<unknown>, id: string) {
      try {
        await t.none(`DELETE FROM ${schema}.${tbl} WHERE id=$1;`, [id]);
      } catch (e) {
        throw genericInternalError(`del doc: ${e}`);
      }
    },

    async cleanStage() {
      try {
        await conn.none(`TRUNCATE TABLE ${stage};`);
      } catch (e) {
        throw genericInternalError(`clean doc stage: ${e}`);
      }
    },
  };
}
export type AgreementConsumerDocumentRepo = ReturnType<
  typeof agreementConsumerDocumentRepo
>;
