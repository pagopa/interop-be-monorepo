import { Logger } from "pagopa-interop-commons";
import {
  AsyncPlatformStatesCatalogEntry,
  EService,
  makePlatformStatesEServiceDescriptorPK,
  PlatformStatesCatalogEntry,
  PlatformStatesGenericEntry,
} from "pagopa-interop-models";
import {
  descriptorItemState,
  getAsyncDescriptors,
  logDifference,
} from "./common.js";

type ComparableAsyncPlatformStatesCatalogEntry = Pick<
  AsyncPlatformStatesCatalogEntry,
  | "PK"
  | "state"
  | "descriptorAudience"
  | "descriptorVoucherLifespan"
  | "asyncExchange"
  | "asyncExchangeProperties"
>;

type AsyncPlatformStatesComparisonResult = {
  differencesCount: number;
  asyncPlatformStatesByPK: Map<string, AsyncPlatformStatesCatalogEntry>;
};

const buildExpectedAsyncPlatformStatesByPK = (
  eservices: EService[]
): Map<string, ComparableAsyncPlatformStatesCatalogEntry> =>
  new Map(
    getAsyncDescriptors(eservices).map(({ eservice, descriptor }) => {
      const pk = makePlatformStatesEServiceDescriptorPK({
        eserviceId: eservice.id,
        descriptorId: descriptor.id,
      });
      return [
        pk,
        {
          PK: pk,
          state: descriptorItemState(descriptor),
          descriptorAudience: descriptor.audience,
          descriptorVoucherLifespan: descriptor.voucherLifespan,
          asyncExchange: true,
          asyncExchangeProperties: descriptor.asyncExchangeProperties,
        },
      ];
    })
  );

const comparableAsyncPlatformStatesEntry = (
  entry: AsyncPlatformStatesCatalogEntry
): ComparableAsyncPlatformStatesCatalogEntry => ({
  PK: entry.PK,
  state: entry.state,
  descriptorAudience: entry.descriptorAudience,
  descriptorVoucherLifespan: entry.descriptorVoucherLifespan,
  asyncExchange: entry.asyncExchange,
  asyncExchangeProperties: entry.asyncExchangeProperties,
});

const countMissingAsyncPlatformStatesEntries = ({
  expectedByPK,
  seenExpectedPKs,
  logger,
}: {
  expectedByPK: Map<string, ComparableAsyncPlatformStatesCatalogEntry>;
  seenExpectedPKs: Set<string>;
  logger: Logger;
}): number => {
  let differencesCount = 0;

  for (const [pk, expected] of expectedByPK) {
    if (!seenExpectedPKs.has(pk)) {
      differencesCount += logDifference({
        logger,
        message: `Missing or invalid async platform-states catalog entry ${pk}`,
        actual: undefined,
        expected,
      });
    }
  }

  return differencesCount;
};

const compareAsyncPlatformStatesEntry = ({
  entry,
  expectedByPK,
  seenExpectedPKs,
  asyncPlatformStatesByPK,
  logger,
}: {
  entry: PlatformStatesGenericEntry;
  expectedByPK: Map<string, ComparableAsyncPlatformStatesCatalogEntry>;
  seenExpectedPKs: Set<string>;
  asyncPlatformStatesByPK: Map<string, AsyncPlatformStatesCatalogEntry>;
  logger: Logger;
}): number => {
  const parsedCatalogEntry = PlatformStatesCatalogEntry.safeParse(entry);
  if (!parsedCatalogEntry.success) {
    return 0;
  }

  const { PK: pk } = parsedCatalogEntry.data;
  const expected = expectedByPK.get(pk);
  const parsedAsyncEntry = AsyncPlatformStatesCatalogEntry.safeParse(
    parsedCatalogEntry.data
  );

  if (parsedAsyncEntry.success) {
    asyncPlatformStatesByPK.set(pk, parsedAsyncEntry.data);
  }

  if (expected) {
    seenExpectedPKs.add(pk);

    if (!parsedAsyncEntry.success) {
      return logDifference({
        logger,
        message: `Missing or invalid async platform-states catalog entry ${pk}`,
        actual: parsedCatalogEntry.data,
        expected,
      });
    }

    const comparableActual = comparableAsyncPlatformStatesEntry(
      parsedAsyncEntry.data
    );

    return JSON.stringify(comparableActual) !== JSON.stringify(expected)
      ? logDifference({
          logger,
          message: `Differences in async platform-states catalog entry ${pk}`,
          actual: comparableActual,
          expected,
        })
      : 0;
  }

  return parsedCatalogEntry.data.asyncExchange === true
    ? logDifference({
        logger,
        message: `Unexpected async platform-states catalog entry ${pk}`,
        actual: parsedCatalogEntry.data,
        expected: undefined,
      })
    : 0;
};

const compareAsyncPlatformStatesEntries = ({
  eservices,
  platformStates,
  logger,
}: {
  eservices: EService[];
  platformStates: Iterable<PlatformStatesGenericEntry>;
  logger: Logger;
}): AsyncPlatformStatesComparisonResult => {
  const expectedByPK = buildExpectedAsyncPlatformStatesByPK(eservices);
  const seenExpectedPKs = new Set<string>();
  const asyncPlatformStatesByPK = new Map<
    string,
    AsyncPlatformStatesCatalogEntry
  >();
  let differencesCount = 0;

  for (const entry of platformStates) {
    differencesCount += compareAsyncPlatformStatesEntry({
      entry,
      expectedByPK,
      seenExpectedPKs,
      asyncPlatformStatesByPK,
      logger,
    });
  }

  differencesCount += countMissingAsyncPlatformStatesEntries({
    expectedByPK,
    seenExpectedPKs,
    logger,
  });

  return { differencesCount, asyncPlatformStatesByPK };
};

export const compareAsyncPlatformStatesPages = async ({
  eservices,
  platformStatesPages,
  logger,
}: {
  eservices: EService[];
  platformStatesPages: AsyncGenerator<PlatformStatesGenericEntry[], void, void>;
  logger: Logger;
}): Promise<AsyncPlatformStatesComparisonResult> => {
  const expectedByPK = buildExpectedAsyncPlatformStatesByPK(eservices);
  const seenExpectedPKs = new Set<string>();
  const asyncPlatformStatesByPK = new Map<
    string,
    AsyncPlatformStatesCatalogEntry
  >();
  let differencesCount = 0;

  for await (const page of platformStatesPages) {
    for (const entry of page) {
      differencesCount += compareAsyncPlatformStatesEntry({
        entry,
        expectedByPK,
        seenExpectedPKs,
        asyncPlatformStatesByPK,
        logger,
      });
    }
  }

  differencesCount += countMissingAsyncPlatformStatesEntries({
    expectedByPK,
    seenExpectedPKs,
    logger,
  });

  return { differencesCount, asyncPlatformStatesByPK };
};

export const compareAsyncPlatformStates = ({
  eservices,
  platformStates,
  logger,
}: {
  eservices: EService[];
  platformStates: PlatformStatesGenericEntry[];
  logger: Logger;
}): number =>
  compareAsyncPlatformStatesEntries({
    eservices,
    platformStates,
    logger,
  }).differencesCount;
