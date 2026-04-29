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

const toUTCMidnight = (d: Date, offsetDays: number = 0): number =>
  Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offsetDays);

export function isArchivable(
  archivableOn: Date,
  now: Date = new Date()
): boolean {
  const yesterdayMidnightUTC = toUTCMidnight(now, -1);
  const archivableOnMidnightUTC = toUTCMidnight(archivableOn);

  return yesterdayMidnightUTC >= archivableOnMidnightUTC;
}
