import { Logger } from "pagopa-interop-commons";
import {
  Agreement,
  agreementState,
  AsyncExchangeProperties,
  Client,
  Descriptor,
  descriptorState,
  EService,
  GSIPKConsumerIdEServiceId,
  itemState,
  ItemState,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKEServiceIdDescriptorId,
  Purpose,
  PurposeId,
  PurposeVersion,
  purposeVersionState,
} from "pagopa-interop-models";
import { diff } from "json-diff";
import {
  ProducerKeychainReadModelEntry,
  ReadModelServiceSQL,
} from "../services/readModelServiceSQL.js";

type DescriptorWithAsyncExchangeProperties = Descriptor & {
  asyncExchangeProperties: AsyncExchangeProperties;
};

export type AsyncDescriptor = {
  eservice: EService;
  descriptor: DescriptorWithAsyncExchangeProperties;
};

export type ReadModelContext = {
  eservices: EService[];
  purposes: Purpose[];
  agreements: Agreement[];
  clients: Client[];
  producerKeychains: ProducerKeychainReadModelEntry[];
};

const validDescriptorStates = [
  descriptorState.published,
  descriptorState.suspended,
  descriptorState.deprecated,
] as string[];

const activeOrInactive = (isActive: boolean): ItemState =>
  isActive ? itemState.active : itemState.inactive;

const hasAsyncExchangeProperties = (
  descriptor: Descriptor
): descriptor is DescriptorWithAsyncExchangeProperties =>
  descriptor.asyncExchangeProperties !== undefined;

export const descriptorItemState = (descriptor: Descriptor): ItemState =>
  activeOrInactive(descriptor.state === descriptorState.published);

export const purposeVersionItemState = (
  purposeVersion: PurposeVersion
): ItemState =>
  activeOrInactive(purposeVersion.state === purposeVersionState.active);

export const agreementItemState = (agreement: Agreement): ItemState =>
  activeOrInactive(agreement.state === agreementState.active);

export const getLastPurposeVersion = (
  purposeVersions: PurposeVersion[]
): PurposeVersion | undefined =>
  purposeVersions
    .filter(
      (purposeVersion) =>
        purposeVersion.state === purposeVersionState.active ||
        purposeVersion.state === purposeVersionState.suspended ||
        purposeVersion.state === purposeVersionState.archived
    )
    .toSorted(
      (purposeVersion1, purposeVersion2) =>
        purposeVersion2.createdAt.getTime() -
        purposeVersion1.createdAt.getTime()
    )[0];

export const getLastAgreement = (
  agreements: Agreement[]
): Agreement | undefined =>
  agreements
    .filter(
      (agreement) =>
        agreement.state === agreementState.active ||
        agreement.state === agreementState.suspended ||
        agreement.state === agreementState.archived
    )
    .toSorted(
      (agreement1, agreement2) =>
        agreement2.createdAt.getTime() - agreement1.createdAt.getTime()
    )[0];

export const getAsyncDescriptors = (eservices: EService[]): AsyncDescriptor[] =>
  eservices.flatMap((eservice) =>
    eservice.asyncExchange === true
      ? eservice.descriptors
          .filter(
            (descriptor): descriptor is DescriptorWithAsyncExchangeProperties =>
              hasAsyncExchangeProperties(descriptor) &&
              validDescriptorStates.includes(descriptor.state)
          )
          .map((descriptor) => ({ eservice, descriptor }))
      : []
  );

export const buildPurposeMaps = (
  purposes: Purpose[]
): {
  purposesById: Map<PurposeId, Purpose>;
} => ({
  purposesById: new Map(purposes.map((purpose) => [purpose.id, purpose])),
});

export const buildAgreementMaps = (
  agreements: Agreement[]
): {
  agreementsByConsumerIdEServiceId: Map<GSIPKConsumerIdEServiceId, Agreement[]>;
} => {
  const agreementsByConsumerIdEServiceId = new Map<
    GSIPKConsumerIdEServiceId,
    Agreement[]
  >();

  for (const agreement of agreements) {
    const consumerIdEServiceId = makeGSIPKConsumerIdEServiceId({
      consumerId: agreement.consumerId,
      eserviceId: agreement.eserviceId,
    });
    const existingAgreements =
      agreementsByConsumerIdEServiceId.get(consumerIdEServiceId);

    agreementsByConsumerIdEServiceId.set(consumerIdEServiceId, [
      ...(existingAgreements || []),
      agreement,
    ]);
  }

  return { agreementsByConsumerIdEServiceId };
};

export const buildAsyncDescriptorMap = (
  eservices: EService[]
): Map<string, AsyncDescriptor> =>
  new Map(
    getAsyncDescriptors(eservices).map(({ eservice, descriptor }) => [
      makeGSIPKEServiceIdDescriptorId({
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      }),
      { eservice, descriptor },
    ])
  );

export const logDifference = ({
  logger,
  message,
  actual,
  expected,
}: {
  logger: Logger;
  message: string;
  actual: unknown;
  expected: unknown;
}): number => {
  const jsonDiff = diff(actual, expected);
  logger.error(
    `${message}: ${JSON.stringify(jsonDiff ?? { actual, expected })}`
  );
  return 1;
};

export const collectReadModelContext = async (
  readModelService: ReadModelServiceSQL
): Promise<ReadModelContext> => ({
  eservices: await readModelService.getAllReadModelEServices(),
  purposes: await readModelService.getAllReadModelPurposes(),
  agreements: await readModelService.getAllReadModelAgreements(),
  clients: await readModelService.getAllReadModelClients(),
  producerKeychains:
    await readModelService.getAllProducerKeychainReadModelEntries(),
});
