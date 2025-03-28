import { diff } from "json-diff";
import isEqual from "lodash.isequal";
import { Logger } from "pagopa-interop-commons";
import { WithMetadata } from "pagopa-interop-models";

function getIdentificationKey<T extends { id: string } | { kid: string }>(
  obj: T
): string {
  return "id" in obj ? obj.id : obj.kid;
}

export function zipDataById<T extends { id: string } | { kid: string }>(
  dataA: Array<WithMetadata<T>>,
  dataB: Array<WithMetadata<T>>
): Array<[WithMetadata<T> | undefined, WithMetadata<T> | undefined]> {
  const allIds = new Set(
    [...dataA, ...dataB].map((d) => getIdentificationKey(d.data))
  );
  return Array.from(allIds).map((id) => [
    dataA.find((d) => getIdentificationKey(d.data) === id),
    dataB.find((d) => getIdentificationKey(d.data) === id),
  ]);
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function compare<T extends { id: string } | { kid: string }>({
  collectionItems,
  postgresItems,
  schema,
  loggerInstance,
}: {
  collectionItems: Array<WithMetadata<T>>;
  postgresItems: Array<WithMetadata<T>>;
  schema: string;
  loggerInstance: Logger;
}): number {
  if (postgresItems.length === 0) {
    loggerInstance.info(
      `Skipping checks for ${schema} schema because it's empty`
    );

    return -1;
  }

  const allIds = new Set(
    [...collectionItems, ...postgresItems].map((d) =>
      getIdentificationKey(d.data)
    )
  );
  const pairs = Array.from(allIds).map((id) => [
    collectionItems.find((d) => getIdentificationKey(d.data) === id),
    postgresItems.find((d) => getIdentificationKey(d.data) === id),
  ]);

  const pairsWithDifferences = pairs.filter(([a, b]) => !isEqual(a, b));

  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  pairsWithDifferences.forEach(([itemFromCollection, itemFromSQL]) => {
    if (itemFromCollection && !itemFromSQL) {
      differencesCount++;
      loggerInstance.warn(
        `Object with id ${getIdentificationKey(
          itemFromCollection.data
        )} not found in SQL readmodel`
      );
    }
    if (!itemFromCollection && itemFromSQL) {
      differencesCount++;
      loggerInstance.warn(
        `Object with id ${getIdentificationKey(
          itemFromSQL.data
        )} not found in collection`
      );
    }
    if (itemFromCollection && itemFromSQL) {
      const objectsDiff = diff(itemFromSQL, itemFromCollection, {
        sort: true,
      });
      if (objectsDiff) {
        differencesCount++;
        loggerInstance.warn(
          `Differences in object with id ${getIdentificationKey(
            itemFromCollection.data
          )}`
        );
        loggerInstance.warn(
          JSON.stringify(
            objectsDiff,
            (_k, v) => (v === undefined ? "undefined" : v), // this is needed to print differences in fields that are undefined
            2
          )
        );
      }
    }
  });

  if (differencesCount > 0) {
    loggerInstance.warn(`Differences count for ${schema}: ${differencesCount}`);
  } else {
    loggerInstance.info(`No differences found for ${schema}`);
  }

  return differencesCount;
}
