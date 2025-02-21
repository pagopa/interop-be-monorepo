/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  getMockEServiceAttribute,
  getMockValidRiskAnalysis,
} from "pagopa-interop-commons-test";
import { describe, it, expect } from "vitest";
import { Descriptor, EService, tenantKind } from "pagopa-interop-models";
import { diff } from "json-diff";
import {
  eserviceDescriptorAttributeInReadmodelCatalog,
  eserviceDescriptorDocumentInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  eserviceRiskAnalysisAnswerInReadmodelCatalog,
  eserviceRiskAnalysisInReadmodelCatalog,
} from "pagopa-interop-readmodel-models";
import {
  eserviceJoin,
  fromJoinToAggregator,
} from "../src/catalog/retrievalJoin.js";
import { splitEserviceIntoObjectsSQL } from "../src/catalog/splitters.js";
import { aggregateEservice } from "../src/catalog/aggregators.js";
import { readModelDB } from "./utils.js";

describe("", () => {
  it("first test", async () => {
    const descriptor1: Descriptor = {
      ...getMockDescriptor(),
      version: "1",
      interface: getMockDocument(),
      docs: [getMockDocument()],
      attributes: {
        certified: [[getMockEServiceAttribute()]],
        declared: [[getMockEServiceAttribute()]],
        verified: [[getMockEServiceAttribute()]],
      },
    };
    const descriptor2: Descriptor = {
      ...getMockDescriptor(),
      version: "2",
      interface: getMockDocument(),
      docs: [getMockDocument()],
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
      descriptors: [descriptor1, descriptor2, descriptor3],
      riskAnalysis: [riskAnalysis1, riskAnalysis2],
    };

    const resSQL = splitEserviceIntoObjectsSQL(eservice, 1);

    await readModelDB.delete(eserviceInReadmodelCatalog);
    await readModelDB.transaction(async (tx) => {
      await tx.insert(eserviceInReadmodelCatalog).values(resSQL.eserviceSQL);

      for (const descriptor of resSQL.descriptorsSQL) {
        await tx
          .insert(eserviceDescriptorInReadmodelCatalog)
          .values(descriptor);
      }

      for (const doc of resSQL.documentsSQL) {
        await tx
          .insert(eserviceDescriptorDocumentInReadmodelCatalog)
          .values(doc);
      }

      for (const att of resSQL.attributesSQL) {
        await tx
          .insert(eserviceDescriptorAttributeInReadmodelCatalog)
          .values(att);
      }

      for (const riskAnalysis of resSQL.riskAnalysesSQL) {
        await tx
          .insert(eserviceRiskAnalysisInReadmodelCatalog)
          .values(riskAnalysis);
      }

      for (const riskAnalysisAnswer of resSQL.riskAnalysisAnswersSQL) {
        await tx
          .insert(eserviceRiskAnalysisAnswerInReadmodelCatalog)
          .values(riskAnalysisAnswer);
      }
    });

    const res = await eserviceJoin(eservice.id, readModelDB);

    const simpleRes = res.map((item) => ({
      eserviceId: item.eservice.id,
      descId: item.descriptor?.id,
      docId: item.document?.id,
      attrId: item.attribute?.attributeId,
      rejectionId: item.rejection?.rejectionReason,
      ra: item.riskAnalysis?.id,
      raAns: item.riskAnalysisAnswer?.id,
      templateBinding: item.templateBinding?.eserviceTemplateId,
    }));
    console.log(simpleRes);
    console.log(res.length);

    const aggregatorInput = fromJoinToAggregator(res);

    const aggregatedEserviceFromDb = aggregateEservice(aggregatorInput);

    const resDiff = diff(
      { data: eservice, metadata: { version: 1 } },
      aggregatedEserviceFromDb,
      { sort: true }
    );

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
