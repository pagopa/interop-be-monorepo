export function bigIntToDate(input: bigint): Date;
export function bigIntToDate(input: bigint | undefined): Date | undefined;
export function bigIntToDate(input: bigint | undefined): Date | undefined {
  return input ? new Date(Number(input)) : undefined;
}

export function dateToBigInt(input: Date): bigint;
export function dateToBigInt(input: Date | undefined): bigint | undefined;
export function dateToBigInt(input: Date | undefined): bigint | undefined {
  return input ? BigInt(input.getTime()) : undefined;
}
