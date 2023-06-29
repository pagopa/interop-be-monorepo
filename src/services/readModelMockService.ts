export function getCatalog(eServiceId: string): number {
  return eServiceId.length > 0 ? 0 : 1;
}
