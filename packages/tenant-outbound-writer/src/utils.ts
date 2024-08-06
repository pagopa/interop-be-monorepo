export type Exact<T, U extends T> = {
  [Key in keyof U]: Key extends keyof T
    ? T[Key] extends object
      ? T[Key] extends infer TObj | undefined
        ? // @ts-expect-error eslint-disable-next-line @typescript-eslint/ban-ts-comment
          Exact<TObj, U[Key]>
        : T[Key]
      : T[Key]
    : undefined;
};
