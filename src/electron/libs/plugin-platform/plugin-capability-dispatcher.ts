import type { PluginAtomicCapability } from "../../../shared/plugin-platform/types.js";
import type { PluginCapabilityGrantRegistry } from "./plugin-capability-grant-registry.js";

export type PluginCapabilityOperation =
  | { kind: "session.context.read" }
  | { kind: "session.main.message.create" }
  | { kind: "session.main.run.start" }
  | { kind: "session.main.run.cancel" }
  | { kind: "session.main.model.set" }
  | { kind: "session.child.create" }
  | { kind: "session.child.read" }
  | { kind: "session.child.publish" }
  | { kind: "session.attachments.receive" }
  | { kind: "models.list" }
  | { kind: "models.select" }
  | { kind: "models.invoke" }
  | { kind: "tools.list" }
  | { kind: "tools.call"; toolName: string };

export type AuthorizedPluginCapabilityOperation = PluginCapabilityOperation;

export type PluginCapabilityDispatchResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code:
        | "CAPABILITY_NOT_GRANTED"
        | "PLUGIN_NOT_ACTIVATABLE"
        | "PLUGIN_NOT_ACTIVE";
      capability: PluginAtomicCapability;
    }
  | {
      ok: false;
      code: "INVALID_TOOL_NAME";
    };

export type DispatchPluginCapabilityOperationInput<T> = {
  registry: PluginCapabilityGrantRegistry;
  pluginId: string;
  operation: PluginCapabilityOperation;
  dispatch: (operation: AuthorizedPluginCapabilityOperation) => T | Promise<T>;
};

type ResolvedPluginCapabilityOperation = {
  capability: PluginAtomicCapability;
  operation: AuthorizedPluginCapabilityOperation;
};

function resolveOperation(
  operation: PluginCapabilityOperation,
): ResolvedPluginCapabilityOperation | null {
  if (operation.kind === "tools.call") {
    const toolName = operation.toolName.trim();
    if (!toolName || toolName === "*") return null;
    return {
      capability: `tools.call:${toolName}`,
      operation: { kind: "tools.call", toolName },
    };
  }

  return { capability: operation.kind, operation };
}

export async function dispatchPluginCapabilityOperation<T>(
  input: DispatchPluginCapabilityOperationInput<T>,
): Promise<PluginCapabilityDispatchResult<T>> {
  const resolved = resolveOperation(input.operation);
  if (!resolved) return { ok: false, code: "INVALID_TOOL_NAME" };

  const authorization = input.registry.authorize(input.pluginId, resolved.capability);
  if (!authorization.ok) return authorization;

  return {
    ok: true,
    value: await input.dispatch(resolved.operation),
  };
}
