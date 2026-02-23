import { diff } from "json-diff";
import isEqual from "lodash.isequal";
import { Logger } from "pagopa-interop-commons";
import { WithMetadata } from "pagopa-interop-models";

function getIdentificationKey<T extends { id: string } | { kid: string }>(
  obj: T
): string {
  return "id" in obj ? obj.id : obj.kid;
}

function zipDataById<T extends { id: string } | { kid: string }>(
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
  kpiItems,
  postgresItems,
  schema,
  loggerInstance,
}: {
  kpiItems: Array<WithMetadata<T>>;
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

  const pairs = zipDataById(kpiItems, postgresItems);

  const pairsWithDifferences = pairs.filter(([a, b]) => !isEqual(a, b));
  const itemName = schema.slice(0, -1);

  // eslint-disable-next-line functional/no-let
  let differencesCount = 0;
  pairsWithDifferences.forEach(([itemFromKPI, itemFromSQL]) => {
    if (itemFromKPI && !itemFromSQL) {
      differencesCount++;
      loggerInstance.warn(
        `${itemName} with id ${getIdentificationKey(
          itemFromKPI.data
        )} not found in SQL readmodel`
      );
    }
    if (!itemFromKPI && itemFromSQL) {
      differencesCount++;
      loggerInstance.warn(
        `${itemName} with id ${getIdentificationKey(
          itemFromSQL.data
        )} not found in KPI readmodel`
      );
    }
    if (itemFromKPI && itemFromSQL) {
      const objectsDiff = diff(itemFromSQL, itemFromKPI, {
        sort: true,
      });
      if (objectsDiff) {
        differencesCount++;
        loggerInstance.warn(
          `Differences in ${itemName} with id ${getIdentificationKey(
            itemFromKPI.data
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
