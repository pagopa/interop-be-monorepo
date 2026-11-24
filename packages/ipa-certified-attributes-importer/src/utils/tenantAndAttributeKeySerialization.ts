export function toTenantKey(key: {
  origin: string | undefined;
  value: string | undefined;
}): string {
  return JSON.stringify({ origin: key.origin, value: key.value });
}

export function toAttributeKey(key: {
  origin: string | undefined;
  code: string | undefined;
}): string {
  return JSON.stringify({ origin: key.origin, code: key.code });
}
