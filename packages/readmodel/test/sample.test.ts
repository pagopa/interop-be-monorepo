/* eslint-disable @typescript-eslint/explicit-function-return-type */
import {
  getMockDescriptor,
  getMockDocument,
  getMockEService,
  getMockEServiceAttribute,
  getMockValidRiskAnalysis,
} from "pagopa-interop-commons-test/index.js";
import { describe, it, expect } from "vitest";
import { Descriptor, EService, tenantKind } from "pagopa-interop-models";
import { db, eserviceJoin } from "../src/catalog/aggregatorsJoin.js";
import { splitEserviceIntoObjectsSQL } from "../src/catalog/splitters.js";
import {
  eserviceDescriptorAttributeInReadmodel,
  eserviceDescriptorDocumentInReadmodel,
  eserviceDescriptorInReadmodel,
  eserviceInReadmodel,
  eserviceRiskAnalysisAnswerInReadmodel,
  eserviceRiskAnalysisInReadmodel,
} from "../src/drizzle/schema.js";

describe("", () => {
  it("", async () => {
    const descriptor1: Descriptor = {
      ...getMockDescriptor(),
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
      interface: getMockDocument(),
      docs: [getMockDocument()],
    };

    const descriptor3: Descriptor = {
      ...getMockDescriptor(),
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

    await db.delete(eserviceInReadmodel);
    await db.transaction(async (tx) => {
      await tx.insert(eserviceInReadmodel).values(resSQL.eserviceSQL);

      for (const descriptor of resSQL.descriptorsSQL) {
        await tx.insert(eserviceDescriptorInReadmodel).values(descriptor);
      }

      for (const doc of resSQL.documentsSQL) {
        await tx.insert(eserviceDescriptorDocumentInReadmodel).values(doc);
      }

      for (const att of resSQL.attributesSQL) {
        await tx.insert(eserviceDescriptorAttributeInReadmodel).values(att);
      }

      for (const riskAnalysis of resSQL.riskAnalysisSQL) {
        await tx.insert(eserviceRiskAnalysisInReadmodel).values(riskAnalysis);
      }

      for (const riskAnalysisAnswer of resSQL.riskAnalysisAnswersSQL) {
        await tx
          .insert(eserviceRiskAnalysisAnswerInReadmodel)
          .values(riskAnalysisAnswer);
      }
    });

    const res = await eserviceJoin();
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
    // eslint-disable-next-line no-console
    console.log(simpleRes);
    // eslint-disable-next-line no-console
    console.log(res.length);

    expect(1).toBe(1);
  });
});
