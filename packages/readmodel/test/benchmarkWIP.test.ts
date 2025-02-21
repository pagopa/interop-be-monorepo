/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  getMockEServiceAttribute,
  getMockValidRiskAnalysis,
} from "pagopa-interop-commons-test/index.js";
import { describe, it, expect } from "vitest";
import {
  Descriptor,
  EService,
  EServiceId,
  generateId,
  tenantKind,
} from "pagopa-interop-models";
import { diff } from "json-diff";
import {
  eserviceDescriptorAttributeInReadmodelCatalog,
  eserviceDescriptorDocumentInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  eserviceDescriptorRejectionReasonInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisAnswerInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
  EServiceSQL,
  EServiceRiskAnalysisSQL,
  EServiceRiskAnalysisAnswerSQL,
  EServiceDescriptorSQL,
  EServiceDescriptorAttributeSQL,
  EServiceDescriptorDocumentSQL,
  EServiceDescriptorRejectionReasonSQL,
  EServiceTemplateBindingSQL,
} from "pagopa-interop-readmodel-models";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  eserviceJoin,
  fromJoinToAggregator,
  fromJoinToAggregatorArray,
} from "../src/catalog/retrievalJoinWIP.js";
import { splitEserviceIntoObjectsSQL } from "../src/catalog/splitters.js";
import {
  aggregateEservice,
  aggregateEserviceArray,
} from "../src/catalog/aggregators.js";
import {
  retrieveDescriptorsSQL,
  retrieveEserviceAttributesSQL,
  retrieveEserviceDocumentSQL,
  retrieveEserviceRiskAnalysesSQL,
  retrieveEserviceRiskAnalysisAnswersSQL,
  retrieveEServiceSQL,
  retrieveEserviceTemplateBindingSQL,
  retrieveRejectionReasonsSQL,
} from "../src/catalog/retrievalMultiQuery.js";

const pool = new Pool({
  host: process.env.READMODEL_SQL_DB_HOST,
  port: Number(process.env.READMODEL_SQL_DB_PORT),
  database: process.env.READMODEL_SQL_DB_NAME,
  user: process.env.READMODEL_SQL_DB_USERNAME,
  password: process.env.READMODEL_SQL_DB_PASSWORD,
  ssl: process.env.READMODEL_SQL_DB_USE_SSL === "true",
});
const db = drizzle({ client: pool });
describe("benchmark", async () => {
  it("basic benchmark", async () => {
    await db.delete(eserviceInReadmodelCatalog);
    const eserviceId = generateId<EServiceId>();

    // eslint-disable-next-line functional/no-let
    for (let i = 0; i < 1000; i++) {
      const descriptor1: Descriptor = {
        ...getMockDescriptor(),
        version: "1",
        interface: getMockDocument(),
        docs: [getMockDocument(), getMockDocument()],
        attributes: {
          certified: [[getMockEServiceAttribute()]],
          declared: [[getMockEServiceAttribute()]],
          verified: [[getMockEServiceAttribute()]],
        },
        rejectionReasons: [
          {
            rejectionReason: "first reason to reject",
            rejectedAt: new Date(),
          },
          {
            rejectionReason: "second reason to reject",
            rejectedAt: new Date(),
          },
        ],
      };
      const descriptor2: Descriptor = {
        ...getMockDescriptor(),
        version: "2",
        interface: getMockDocument(),
        docs: [getMockDocument(), getMockDocument()],
      };

      const descriptor3: Descriptor = {
        ...getMockDescriptor(),
        version: "3",
        interface: undefined,
        docs: [],
      };

      const riskAnalysis1 = getMockValidRiskAnalysis(tenantKind.PA);
      const riskAnalysis2 = getMockValidRiskAnalysis(tenantKind.PRIVATE);

      const eservice: EService = {
        ...getMockEService(),
        id: i === 0 ? eserviceId : generateId(),
        descriptors: [descriptor1, descriptor2, descriptor3],
        riskAnalysis: i < 7 ? [riskAnalysis1, riskAnalysis2] : [],
      };

      const resSQL = splitEserviceIntoObjectsSQL(eservice, 1);

      await addEserviceObjectsInReadmodel(resSQL);
    }

    const timestamp1 = Date.now();
    // console.log(timestamp1);

    const eserviceSQL = await retrieveEServiceSQL(eserviceId, db).then(
      (res) => res[0]
    );
    const descriptorsSQL = await retrieveDescriptorsSQL(eserviceId, db);
    const documentsSQL = await retrieveEserviceDocumentSQL(eserviceId, db);
    const attributesSQL = await retrieveEserviceAttributesSQL(eserviceId, db);
    const rejectionReasonsSQL = await retrieveRejectionReasonsSQL(
      eserviceId,
      db
    );
    const riskAnalysesSQL = await retrieveEserviceRiskAnalysesSQL(
      eserviceId,
      db
    );
    const riskAnalysisAnswersSQL = await retrieveEserviceRiskAnalysisAnswersSQL(
      eserviceId,
      db
    );
    const templateBindingSQL = await retrieveEserviceTemplateBindingSQL(
      eserviceId,
      db
    );

    const timestamp2 = Date.now();
    // console.log(timestamp2);

    const eserviceWithQueries = aggregateEservice({
      eserviceSQL,
      descriptorsSQL,
      documentsSQL,
      attributesSQL,
      rejectionReasonsSQL,
      riskAnalysesSQL,
      riskAnalysisAnswersSQL,
      templateBindingSQL,
    });

    const timestamp3 = Date.now();
    // console.log(timestamp3);

    const resultOfJoin = await eserviceJoin(eserviceId, db);

    const timestamp4 = Date.now();
    // console.log(timestamp4);

    // const aggregatorInput = fromJoinToAggregator(resultOfJoin);
    const aggregatorInput = fromJoinToAggregatorArray(resultOfJoin);

    const timestamp5 = Date.now();
    //  console.log(timestamp5);

    // const eserviceWithJoin = aggregateEservice(aggregatorInput);
    const eserviceWithJoin = aggregateEserviceArray(aggregatorInput);

    const timestamp6 = Date.now();
    // console.log(timestamp6);

    console.log("path1 - only the specific queries: ", timestamp2 - timestamp1);
    console.log("path1 - only the aggregator: ", timestamp3 - timestamp2);
    console.log(
      "path1 - total (specific queries + aggregator): ",
      timestamp3 - timestamp1
    );

    console.log("\n");

    console.log("path2 - only the join: ", timestamp4 - timestamp3);
    console.log("path2 - only the aggregator setup: ", timestamp5 - timestamp4);
    console.log("path2 - only the aggregator: ", timestamp6 - timestamp5);
    console.log(
      "path2 - total (join + aggregator setup + aggregator): ",
      timestamp6 - timestamp3
    );

    // const resDiff = diff(eserviceWithQueries, eserviceWithJoin, {
    //   sort: true,
    // });

    // if (resDiff) {
    //   console.error(resDiff);

    //   // if it fails use this output, otherwise undefined values are not printed
    //   console.log(
    //     JSON.stringify(
    //       resDiff,
    //       (_k, v) => (v === undefined ? "undefined" : v),
    //       2
    //     )
    //   );
    // }

    // expect(resDiff).toBeUndefined();
  });
});

const addEserviceObjectsInReadmodel = async ({
  eserviceSQL,
  riskAnalysisSQL,
  riskAnalysisAnswersSQL,
  descriptorsSQL,
  attributesSQL,
  documentsSQL,
  rejectionReasonsSQL,
}: {
  eserviceSQL: EServiceSQL;
  riskAnalysisSQL: EServiceRiskAnalysisSQL[];
  riskAnalysisAnswersSQL: EServiceRiskAnalysisAnswerSQL[];
  descriptorsSQL: EServiceDescriptorSQL[];
  attributesSQL: EServiceDescriptorAttributeSQL[];
  documentsSQL: EServiceDescriptorDocumentSQL[];
  rejectionReasonsSQL: EServiceDescriptorRejectionReasonSQL[];
  eserviceTemplateBindingSQL?: EServiceTemplateBindingSQL;
}) => {
  await db.transaction(async (tx) => {
    await tx.insert(eserviceInReadmodelCatalog).values(eserviceSQL);

    for (const descriptor of descriptorsSQL) {
      await tx.insert(eserviceDescriptorInReadmodelCatalog).values(descriptor);
    }

    for (const doc of documentsSQL) {
      await tx.insert(eserviceDescriptorDocumentInReadmodelCatalog).values(doc);
    }

    for (const att of attributesSQL) {
      await tx
        .insert(eserviceDescriptorAttributeInReadmodelCatalog)
        .values(att);
    }

    for (const riskAnalysis of riskAnalysisSQL) {
      await tx
        .insert(eserviceRiskAnalysisInReadmodelCatalog)
        .values(riskAnalysis);
    }

    for (const riskAnalysisAnswer of riskAnalysisAnswersSQL) {
      await tx
        .insert(eserviceRiskAnalysisAnswerInReadmodelCatalog)
        .values(riskAnalysisAnswer);
    }

    for (const rejectionReason of rejectionReasonsSQL) {
      await tx
        .insert(eserviceDescriptorRejectionReasonInReadmodelCatalog)
        .values(rejectionReason);
    }
  });
};
