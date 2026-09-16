import ts from "typescript";
import {
  findServiceMethod,
  getServiceMethodBody,
  parseTypeScriptFile,
} from "./typescript";

type ProcessCall = {
  client: string;
  method: string;
};

export function findProcessCalls(
  serviceFileName: string,
  serviceMethodName?: string,
): ProcessCall[] {
  if (!serviceMethodName) {
    return [];
  }

  const methodName = serviceMethodName;

  if (serviceFileName === "NOT FOUND") {
    return [];
  }

  const sourceFile = parseTypeScriptFile(serviceFileName);
  if (!sourceFile) {
    return [];
  }

  const result: ProcessCall[] = [];

  function findCalls(node: ts.Node): void {
    function visit(child: ts.Node): void {
      if (ts.isCallExpression(child)) {
        const processCall = getProcessCall(child);

        if (processCall) {
          result.push(processCall);
        }
      }

      ts.forEachChild(child, visit);
    }

    visit(node);
  }

  function getProcessCall(call: ts.CallExpression): ProcessCall | undefined {
    if (!ts.isPropertyAccessExpression(call.expression)) {
      return undefined;
    }

    const method = call.expression.name.text;

    let expression: ts.Expression = call.expression.expression;
    const clientParts: string[] = [];

    while (ts.isPropertyAccessExpression(expression)) {
      clientParts.unshift(expression.name.text);
      expression = expression.expression;
    }

    if (!ts.isIdentifier(expression)) {
      return undefined;
    }

    const rootClient = expression.text;

    if (!rootClient.endsWith("Client")) {
      return undefined;
    }

    clientParts.unshift(rootClient);

    return {
      client: clientParts.join("."),
      method,
    };
  }

  const method = findServiceMethod(sourceFile, methodName);
  const methodBody = method && getServiceMethodBody(method);
  if (methodBody) {
    findCalls(methodBody);
  }

  return result;
}
