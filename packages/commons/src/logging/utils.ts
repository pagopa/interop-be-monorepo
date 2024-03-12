export function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    const date = new Date(Number(value));
    return date.toISOString();
  }
  return value;
}
