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
import {
  eserviceJoin,
  fromJoinToAggregator,
} from "../src/catalog/retrievalJoin.js";
import { splitEserviceIntoObjectsSQL } from "../src/catalog/splitters.js";
import { eserviceSQLtoEservice } from "../src/catalog/aggregators.js";
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
import { readModelDB } from "./utils.js";

describe("benchmark", async () => {
  it("basic benchmark", async () => {
    await readModelDB.delete(eserviceInReadmodelCatalog);
    const eserviceId = generateId<EServiceId>();

    // eslint-disable-next-line functional/no-let
    for (let i = 0; i < 5; i++) {
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
        riskAnalysis: [riskAnalysis1, riskAnalysis2],
      };

      const resSQL = splitEserviceIntoObjectsSQL(eservice, 1);

      await addEserviceObjectsInReadmodel(resSQL);
    }

    const timestamp1 = Date.now();
    // console.log(timestamp1);

    const eserviceSQL = await retrieveEServiceSQL(eserviceId, readModelDB).then(
      (res) => res[0]
    );
    const descriptorsSQL = await retrieveDescriptorsSQL(
      eserviceId,
      readModelDB
    );
    const documentsSQL = await retrieveEserviceDocumentSQL(
      eserviceId,
      readModelDB
    );
    const attributesSQL = await retrieveEserviceAttributesSQL(
      eserviceId,
      readModelDB
    );
    const rejectionReasonsSQL = await retrieveRejectionReasonsSQL(
      eserviceId,
      readModelDB
    );
    const riskAnalysesSQL = await retrieveEserviceRiskAnalysesSQL(
      eserviceId,
      readModelDB
    );
    const riskAnalysisAnswersSQL = await retrieveEserviceRiskAnalysisAnswersSQL(
      eserviceId,
      readModelDB
    );
    const templateBindingSQL = await retrieveEserviceTemplateBindingSQL(
      eserviceId,
      readModelDB
    );

    const timestamp2 = Date.now();
    // console.log(timestamp2);

    const eserviceWithQueries = eserviceSQLtoEservice({
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

    const resultOfJoin = await eserviceJoin(eserviceId, readModelDB);

    const timestamp4 = Date.now();
    // console.log(timestamp4);

    const aggregatorInput = fromJoinToAggregator(resultOfJoin);

    const timestamp5 = Date.now();
    //  console.log(timestamp5);

    const eserviceWithJoin = eserviceSQLtoEservice(aggregatorInput);

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

    const resDiff = diff(eserviceWithQueries, eserviceWithJoin, {
      sort: true,
    });

    if (resDiff) {
      console.error(resDiff);

      // if it fails use this output, otherwise undefined values are not printed
      console.log(
        JSON.stringify(
          resDiff,
          (_k, v) => (v === undefined ? "undefined" : v),
          2
        )
      );
    }

    expect(resDiff).toBeUndefined();
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
  await readModelDB.transaction(async (tx) => {
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
