export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack
      ? `${error.name}: ${error.message}\nStack trace:\n${error.stack}`
      : `${error.name}: ${error.message}`;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
