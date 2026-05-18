export function calculateArchivableOn(
  requestDate: Date,
  gracePeriodDays: number
): { startedAt: Date; archivableOn: Date } {
  const startedAt = new Date(requestDate);
  const archivableOn = new Date(startedAt.getTime());
  archivableOn.setUTCDate(archivableOn.getUTCDate() + gracePeriodDays + 1);
  archivableOn.setUTCHours(0, 0, 0, 0);
  return { startedAt, archivableOn };
}
