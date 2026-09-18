import { findServiceMethod, parseTypeScriptFile } from "./typescriptParser.js";

type SourceLocation = {
  startLine: number;
  endLine: number;
};

export function findServiceMethodLocation(
  serviceFileName: string,
  serviceMethodName?: string,
): SourceLocation | undefined {
  if (!serviceMethodName || serviceFileName === "NOT FOUND") {
    return undefined;
  }

  const sourceFile = parseTypeScriptFile(serviceFileName);
  if (!sourceFile) {
    return undefined;
  }
  const method = findServiceMethod(sourceFile, serviceMethodName);
  if (!method) {
    return undefined;
  }

  return {
    startLine:
      sourceFile.getLineAndCharacterOfPosition(method.getStart(sourceFile))
        .line + 1,
    endLine: sourceFile.getLineAndCharacterOfPosition(method.getEnd()).line + 1,
  };
}
