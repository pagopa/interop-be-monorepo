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

export function stringToDate(input: string): Date;
export function stringToDate(input: string | null): Date | undefined;
export function stringToDate(input: string | null): Date | undefined {
  return input ? new Date(input) : undefined;
}

export function dateToString(input: Date): string;
export function dateToString(input: Date | undefined): string | null;
export function dateToString(input: Date | undefined): string | null {
  return input ? input.toISOString() : null;
}
