export const bigIntToDateOrUndefined = (
  input: bigint | undefined
): Date | undefined => (input ? new Date(Number(input)) : undefined);

export const bigIntToDate = (input: bigint): Date => new Date(Number(input));

export const dateToBigIntOrUndefined = (
  input: Date | undefined
): bigint | undefined => (input ? BigInt(input.getTime()) : undefined);
