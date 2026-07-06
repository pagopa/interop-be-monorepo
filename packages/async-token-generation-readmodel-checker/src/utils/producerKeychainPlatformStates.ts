import { Logger } from "pagopa-interop-commons";
import {
  makeProducerKeychainPlatformStatesPK,
  ProducerKeychainPlatformStateEntry,
} from "pagopa-interop-models";
import { ProducerKeychainReadModelEntry } from "../services/readModelServiceSQL.js";
import { logDifference } from "./common.js";

type ComparableProducerKeychainPlatformStateEntry = Pick<
  ProducerKeychainPlatformStateEntry,
  | "PK"
  | "publicKey"
  | "producerKeychainId"
  | "producerId"
  | "kid"
  | "eServiceId"
>;

const buildExpectedProducerKeychainPlatformStatesByPK = (
  producerKeychains: ProducerKeychainReadModelEntry[]
): Map<string, ComparableProducerKeychainPlatformStateEntry> =>
  new Map(
    producerKeychains.map((entry) => {
      const pk = makeProducerKeychainPlatformStatesPK({
        producerKeychainId: entry.producerKeychainId,
        kid: entry.kid,
        eServiceId: entry.eServiceId,
      });
      return [
        pk,
        {
          PK: pk,
          publicKey: entry.publicKey,
          producerKeychainId: entry.producerKeychainId,
          producerId: entry.producerId,
          kid: entry.kid,
          eServiceId: entry.eServiceId,
        },
      ];
    })
  );

const comparableProducerKeychainPlatformStateEntry = (
  entry: ProducerKeychainPlatformStateEntry
): ComparableProducerKeychainPlatformStateEntry => ({
  PK: entry.PK,
  publicKey: entry.publicKey,
  producerKeychainId: entry.producerKeychainId,
  producerId: entry.producerId,
  kid: entry.kid,
  eServiceId: entry.eServiceId,
});

const compareProducerKeychainPlatformStateEntries = ({
  expectedByPK,
  producerKeychainPlatformStates,
  logger,
}: {
  expectedByPK: Map<string, ComparableProducerKeychainPlatformStateEntry>;
  producerKeychainPlatformStates: Iterable<ProducerKeychainPlatformStateEntry>;
  logger: Logger;
}): { differencesCount: number; seenExpectedPKs: Set<string> } => {
  const seenExpectedPKs = new Set<string>();
  let differencesCount = 0;

  for (const entry of producerKeychainPlatformStates) {
    const expected = expectedByPK.get(entry.PK);
    if (!expected) {
      differencesCount += logDifference({
        logger,
        message: `Unexpected producer-keychain-platform-states entry ${entry.PK}`,
        actual: entry,
        expected: undefined,
      });
      continue;
    }

    seenExpectedPKs.add(entry.PK);
    const comparableActual =
      comparableProducerKeychainPlatformStateEntry(entry);

    if (JSON.stringify(comparableActual) !== JSON.stringify(expected)) {
      differencesCount += logDifference({
        logger,
        message: `Differences in producer-keychain-platform-states entry ${entry.PK}`,
        actual: comparableActual,
        expected,
      });
    }
  }

  return { differencesCount, seenExpectedPKs };
};

const countMissingExpectedProducerKeychainPlatformStates = ({
  expectedByPK,
  seenExpectedPKs,
  logger,
}: {
  expectedByPK: Map<string, ComparableProducerKeychainPlatformStateEntry>;
  seenExpectedPKs: Set<string>;
  logger: Logger;
}): number => {
  let differencesCount = 0;

  for (const [pk, expected] of expectedByPK) {
    if (!seenExpectedPKs.has(pk)) {
      differencesCount += logDifference({
        logger,
        message: `Missing producer-keychain-platform-states entry ${pk}`,
        actual: undefined,
        expected,
      });
    }
  }

  return differencesCount;
};

export const compareProducerKeychainPlatformStatesPages = async ({
  producerKeychains,
  producerKeychainPlatformStatesPages,
  logger,
}: {
  producerKeychains: ProducerKeychainReadModelEntry[];
  producerKeychainPlatformStatesPages: AsyncGenerator<
    ProducerKeychainPlatformStateEntry[],
    void,
    void
  >;
  logger: Logger;
}): Promise<number> => {
  const expectedByPK =
    buildExpectedProducerKeychainPlatformStatesByPK(producerKeychains);
  const seenExpectedPKs = new Set<string>();
  let differencesCount = 0;

  for await (const page of producerKeychainPlatformStatesPages) {
    const result = compareProducerKeychainPlatformStateEntries({
      expectedByPK,
      producerKeychainPlatformStates: page,
      logger,
    });
    differencesCount += result.differencesCount;
    for (const pk of result.seenExpectedPKs) {
      seenExpectedPKs.add(pk);
    }
  }

  return (
    differencesCount +
    countMissingExpectedProducerKeychainPlatformStates({
      expectedByPK,
      seenExpectedPKs,
      logger,
    })
  );
};
