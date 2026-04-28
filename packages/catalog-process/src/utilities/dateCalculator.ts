export function calculateArchivableOn(
  requestDate: Date,
  gracePeriodDays: number
): { startedAt: Date; archivableOn: Date } {
  const startedAt = new Date(requestDate);
  const archivableOn = new Date(
    new Date(requestDate).setUTCDate(requestDate.getUTCDate() + gracePeriodDays)
  );
  return { startedAt, archivableOn };
}
