import ts from "typescript";

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

  const source = ts.sys.readFile(serviceFileName);

  if (!source) {
    return undefined;
  }

  const sourceFile = ts.createSourceFile(
    serviceFileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  let result: SourceLocation | undefined;

  function visit(node: ts.Node): void {
    if (result) {
      return;
    }

    // async updateTenantDelegatedFeatures(...) { ... }
    if (
      ts.isMethodDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === serviceMethodName
    ) {
      result = {
        startLine:
          sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
            .line + 1,
        endLine:
          sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1,
      };

      return;
    }

    // updateTenantDelegatedFeatures: async (...) => { ... }
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === serviceMethodName
    ) {
      result = {
        startLine:
          sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
            .line + 1,
        endLine:
          sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1,
      };

      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return result;
}
