export function calculateArchivableOn(gracePeriodDays: number): Date {
  const archivableOn = new Date();
  archivableOn.setUTCDate(archivableOn.getUTCDate() + gracePeriodDays + 1);
  archivableOn.setUTCHours(0, 0, 0, 0);
  return archivableOn;
}
