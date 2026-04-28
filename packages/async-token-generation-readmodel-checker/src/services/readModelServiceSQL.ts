import { and, eq } from "drizzle-orm";
import {
  Agreement,
  Client,
  EService,
  EServiceId,
  ProducerKeychainId,
  Purpose,
  TenantId,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  aggregateAgreementArray,
  aggregateClientArray,
  aggregateEserviceArray,
  aggregatePurposeArray,
} from "pagopa-interop-readmodel";
import {
  agreementInReadmodelAgreement,
  agreementStampInReadmodelAgreement,
  clientInReadmodelClient,
  clientKeyInReadmodelClient,
  clientPurposeInReadmodelClient,
  DrizzleReturnType,
  eserviceDescriptorAsyncExchangePropertiesInReadmodelCatalog,
  eserviceDescriptorInReadmodelCatalog,
  eserviceInReadmodelCatalog,
  producerKeychainEserviceInReadmodelProducerKeychain,
  producerKeychainInReadmodelProducerKeychain,
  producerKeychainKeyInReadmodelProducerKeychain,
  purposeInReadmodelPurpose,
  purposeVersionInReadmodelPurpose,
} from "pagopa-interop-readmodel-models";

export type ProducerKeychainReadModelEntry = {
  producerKeychainId: ProducerKeychainId;
  producerId: TenantId;
  kid: string;
  publicKey: string;
  eServiceId: EServiceId;
};

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
      const asyncExchangePropertiesSQL = await readModelDB
        .select()
        .from(eserviceDescriptorAsyncExchangePropertiesInReadmodelCatalog);

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
        asyncExchangePropertiesSQL,
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

    async getAllProducerKeychainReadModelEntries(): Promise<
      ProducerKeychainReadModelEntry[]
    > {
      const rows = await readModelDB
        .select({
          producerKeychainId: producerKeychainInReadmodelProducerKeychain.id,
          producerId: producerKeychainInReadmodelProducerKeychain.producerId,
          kid: producerKeychainKeyInReadmodelProducerKeychain.kid,
          publicKey: producerKeychainKeyInReadmodelProducerKeychain.encodedPem,
          eServiceId:
            producerKeychainEserviceInReadmodelProducerKeychain.eserviceId,
        })
        .from(producerKeychainInReadmodelProducerKeychain)
        .innerJoin(
          producerKeychainKeyInReadmodelProducerKeychain,
          and(
            eq(
              producerKeychainInReadmodelProducerKeychain.id,
              producerKeychainKeyInReadmodelProducerKeychain.producerKeychainId
            ),
            eq(
              producerKeychainInReadmodelProducerKeychain.metadataVersion,
              producerKeychainKeyInReadmodelProducerKeychain.metadataVersion
            )
          )
        )
        .innerJoin(
          producerKeychainEserviceInReadmodelProducerKeychain,
          and(
            eq(
              producerKeychainInReadmodelProducerKeychain.id,
              producerKeychainEserviceInReadmodelProducerKeychain.producerKeychainId
            ),
            eq(
              producerKeychainInReadmodelProducerKeychain.metadataVersion,
              producerKeychainEserviceInReadmodelProducerKeychain.metadataVersion
            )
          )
        );

      return rows.map((row) => ({
        producerKeychainId: unsafeBrandId<ProducerKeychainId>(
          row.producerKeychainId
        ),
        producerId: unsafeBrandId<TenantId>(row.producerId),
        kid: row.kid,
        publicKey: row.publicKey,
        eServiceId: unsafeBrandId<EServiceId>(row.eServiceId),
      }));
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
