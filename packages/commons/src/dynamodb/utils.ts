/**
 * DynamoDB does not support nested object keys, this type removes all keys that contain objects.
 */
export type DynamoDBKeyOf<T> = Partial<{
  [K in keyof T as T[K] extends object ? never : K]: T[K] extends object
    ? never
    : T[K];
}>;

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;
