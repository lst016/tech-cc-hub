import type { PluginCapabilityDispatchResult } from "./plugin-capability-dispatcher.js";
import { dispatchPluginCapabilityOperation } from "./plugin-capability-dispatcher.js";
import type { PluginCapabilityGrantRegistry } from "./plugin-capability-grant-registry.js";

export type PluginRuntimeAdapterContext = Readonly<{
  pluginId: string;
}>;

export type PluginRuntimeToolAdapterContext = Readonly<{
  pluginId: string;
  toolName: string;
}>;

export type PluginRuntimeAdapters = Readonly<{
  listModels: (context: PluginRuntimeAdapterContext) => unknown | Promise<unknown>;
  selectModel: (
    context: PluginRuntimeAdapterContext,
    selection: unknown,
  ) => unknown | Promise<unknown>;
  invokeModel: (
    context: PluginRuntimeAdapterContext,
    request: unknown,
  ) => unknown | Promise<unknown>;
  listTools: (context: PluginRuntimeAdapterContext) => unknown | Promise<unknown>;
  callTool: (
    context: PluginRuntimeToolAdapterContext,
    input: unknown,
  ) => unknown | Promise<unknown>;
}>;

export class PluginRuntimeService {
  readonly #registry: PluginCapabilityGrantRegistry;
  readonly #adapters: PluginRuntimeAdapters;

  constructor(
    registry: PluginCapabilityGrantRegistry,
    adapters: PluginRuntimeAdapters,
  ) {
    this.#registry = registry;
    this.#adapters = adapters;
  }

  listModels(pluginId: string): Promise<PluginCapabilityDispatchResult<unknown>> {
    return dispatchPluginCapabilityOperation({
      registry: this.#registry,
      pluginId,
      operation: { kind: "models.list" },
      dispatch: () => this.#adapters.listModels({ pluginId }),
    });
  }

  selectModel(
    pluginId: string,
    selection: unknown,
  ): Promise<PluginCapabilityDispatchResult<unknown>> {
    return dispatchPluginCapabilityOperation({
      registry: this.#registry,
      pluginId,
      operation: { kind: "models.select" },
      dispatch: () => this.#adapters.selectModel({ pluginId }, selection),
    });
  }

  invokeModel(
    pluginId: string,
    request: unknown,
  ): Promise<PluginCapabilityDispatchResult<unknown>> {
    return dispatchPluginCapabilityOperation({
      registry: this.#registry,
      pluginId,
      operation: { kind: "models.invoke" },
      dispatch: () => this.#adapters.invokeModel({ pluginId }, request),
    });
  }

  listTools(pluginId: string): Promise<PluginCapabilityDispatchResult<unknown>> {
    return dispatchPluginCapabilityOperation({
      registry: this.#registry,
      pluginId,
      operation: { kind: "tools.list" },
      dispatch: () => this.#adapters.listTools({ pluginId }),
    });
  }

  callTool(
    pluginId: string,
    toolName: string,
    input: unknown,
  ): Promise<PluginCapabilityDispatchResult<unknown>> {
    return dispatchPluginCapabilityOperation({
      registry: this.#registry,
      pluginId,
      operation: { kind: "tools.call", toolName },
      dispatch: (operation) => {
        if (operation.kind !== "tools.call") {
          throw new Error("Plugin tool dispatch received a non-tool operation");
        }
        return this.#adapters.callTool(
          { pluginId, toolName: operation.toolName },
          input,
        );
      },
    });
  }
}
