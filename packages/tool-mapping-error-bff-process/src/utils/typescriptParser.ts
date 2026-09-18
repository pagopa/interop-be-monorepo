import ts from "typescript";

type ServiceMethod = ts.MethodDeclaration | ts.PropertyAssignment;

export function parseTypeScriptFile(
  fileName: string
): ts.SourceFile | undefined {
  const source = ts.sys.readFile(fileName);

  if (!source) {
    return undefined;
  }

  return ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
}

export function findServiceMethod(
  sourceFile: ts.SourceFile,
  methodName: string
): ServiceMethod | undefined {
  let result: ServiceMethod | undefined;

  function visit(node: ts.Node): void {
    if (result) {
      return;
    }

    if (
      ts.isMethodDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === methodName
    ) {
      result = node;
      return;
    }

    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === methodName
    ) {
      result = node;
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return result;
}

export function getServiceMethodBody(
  method: ServiceMethod
): ts.Node | undefined {
  if (ts.isMethodDeclaration(method)) {
    return method.body ?? method;
  }

  if (
    ts.isArrowFunction(method.initializer) ||
    ts.isFunctionExpression(method.initializer)
  ) {
    return method.initializer.body;
  }

  return undefined;
}
