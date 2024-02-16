import { GenericCollection } from "pagopa-interop-commons";

/**
 * This function provides a convenient way to write data into a read model
 * by inserting it into a specified collection with an optional version number.
 *
 * @param data
 * @param collection
 * @param version
 */
export const writeInReadmodel = async <T>(
  data: T,
  collection: GenericCollection<T>,
  version: number = 0
): Promise<void> => {
  await collection.insertOne({
    data,
    metadata: {
      version,
    },
  });
};
