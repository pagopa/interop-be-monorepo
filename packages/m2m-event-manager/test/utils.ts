export function testToUpperSnakeCase(str: string): string {
  return str
    .replace("EService", "Eservice") // special case for EService
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2") // insert _ between lower->Upper
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2") // insert _ between consecutive uppers
    .toUpperCase();
}
