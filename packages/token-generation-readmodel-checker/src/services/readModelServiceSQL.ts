import { Agreement, Client, EService, Purpose } from "pagopa-interop-models";
import {
  aggregateEserviceArray,
  aggregatePurposeArray,
  aggregateAgreementArray,
  aggregateClientArray,
} from "pagopa-interop-readmodel";
import {
  agreementInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
  clientInReadmodelClient,
  clientKeyInReadmodelClient,
  clientPurposeInReadmodelClient,
  DrizzleReturnType,
  eserviceDescriptorInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  purposeInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL(readModelDB: DrizzleReturnType) {
  return {
    async getAllReadModelEServices(): Promise<EService[]> {
      const eservicesSQL = await readModelDB
        .select()
        .from(eserviceInReadmodelCatalog);
      const descriptorsSQL = await readModelDB
        .select()
        .from(eserviceDescriptorInReadmodelCatalog);

      return aggregateEserviceArray({
        eservicesSQL,
        descriptorsSQL,
        interfacesSQL: [],
        documentsSQL: [],
        attributesSQL: [],
        rejectionReasonsSQL: [],
        riskAnalysesSQL: [],
        riskAnalysisAnswersSQL: [],
        templateVersionRefsSQL: [],
      }).map((e) => e.data);
    },

    async getAllReadModelPurposes(): Promise<Purpose[]> {
      const purposesSQL = await readModelDB
        .select()
        .from(purposeInReadmodelPurpose);
      const versionsSQL = await readModelDB
        .select()
        .from(purposeVersionInReadmodelPurpose);

      return aggregatePurposeArray({
        purposesSQL,
        versionsSQL,
        riskAnalysisFormsSQL: [],
        riskAnalysisAnswersSQL: [],
        versionDocumentsSQL: [],
        versionStampsSQL: [],
        versionSignedDocumentsSQL: [],
      }).map((p) => p.data);
    },

    async getAllReadModelAgreements(): Promise<Agreement[]> {
      const agreementsSQL = await readModelDB
        .select()
        .from(agreementInReadmodelAgreement);
      const stampsSQL = await readModelDB
        .select()
        .from(agreementStampInReadmodelAgreement);

      return aggregateAgreementArray({
        agreementsSQL,
        stampsSQL,
        attributesSQL: [],
        consumerDocumentsSQL: [],
        contractsSQL: [],
        signedContractsSQL: [],
      }).map((a) => a.data);
    },

    async getAllReadModelClients(): Promise<Client[]> {
      const clientsSQL = await readModelDB
        .select()
        .from(clientInReadmodelClient);
      const purposesSQL = await readModelDB
        .select()
        .from(clientPurposeInReadmodelClient);
      const keysSQL = await readModelDB
        .select()
        .from(clientKeyInReadmodelClient);

      return aggregateClientArray({
        clientsSQL,
        purposesSQL,
        keysSQL,
        usersSQL: [],
      }).map((c) => c.data);
    },
  };
}
export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
