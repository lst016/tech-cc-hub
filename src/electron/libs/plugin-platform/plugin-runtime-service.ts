import type {
  PluginCapabilityDispatchResult,
  PluginCapabilityOperation,
} from "./plugin-capability-dispatcher.js";
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
  readSessionContext: (
    context: PluginRuntimeAdapterContext,
    request: unknown,
  ) => unknown | Promise<unknown>;
  createMainMessage: (
    context: PluginRuntimeAdapterContext,
    message: unknown,
  ) => unknown | Promise<unknown>;
  startMainRun: (
    context: PluginRuntimeAdapterContext,
    request: unknown,
  ) => unknown | Promise<unknown>;
  cancelMainRun: (
    context: PluginRuntimeAdapterContext,
    request: unknown,
  ) => unknown | Promise<unknown>;
  setMainModel: (
    context: PluginRuntimeAdapterContext,
    selection: unknown,
  ) => unknown | Promise<unknown>;
  createChildSession: (
    context: PluginRuntimeAdapterContext,
    request: unknown,
  ) => unknown | Promise<unknown>;
  readChildSession: (
    context: PluginRuntimeAdapterContext,
    request: unknown,
  ) => unknown | Promise<unknown>;
  publishChildSession: (
    context: PluginRuntimeAdapterContext,
    request: unknown,
  ) => unknown | Promise<unknown>;
  receiveSessionAttachments: (
    context: PluginRuntimeAdapterContext,
    attachments: unknown,
  ) => unknown | Promise<unknown>;
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

  #dispatch(
    pluginId: string,
    operation: PluginCapabilityOperation,
    adapter: () => unknown | Promise<unknown>,
  ): Promise<PluginCapabilityDispatchResult<unknown>> {
    return dispatchPluginCapabilityOperation({
      registry: this.#registry,
      pluginId,
      operation,
      dispatch: adapter,
    });
  }

  readSessionContext(
    pluginId: string,
    request: unknown,
  ): Promise<PluginCapabilityDispatchResult<unknown>> {
    return this.#dispatch(
      pluginId,
      { kind: "session.context.read" },
      () => this.#adapters.readSessionContext({ pluginId }, request),
    );
  }

  createMainMessage(
    pluginId: string,
    message: unknown,
  ): Promise<PluginCapabilityDispatchResult<unknown>> {
    return this.#dispatch(
      pluginId,
      { kind: "session.main.message.create" },
      () => this.#adapters.createMainMessage({ pluginId }, message),
    );
  }

  startMainRun(
    pluginId: string,
    request: unknown,
  ): Promise<PluginCapabilityDispatchResult<unknown>> {
    return this.#dispatch(
      pluginId,
      { kind: "session.main.run.start" },
      () => this.#adapters.startMainRun({ pluginId }, request),
    );
  }

  cancelMainRun(
    pluginId: string,
    request: unknown,
  ): Promise<PluginCapabilityDispatchResult<unknown>> {
    return this.#dispatch(
      pluginId,
      { kind: "session.main.run.cancel" },
      () => this.#adapters.cancelMainRun({ pluginId }, request),
    );
  }

  setMainModel(
    pluginId: string,
    selection: unknown,
  ): Promise<PluginCapabilityDispatchResult<unknown>> {
    return this.#dispatch(
      pluginId,
      { kind: "session.main.model.set" },
      () => this.#adapters.setMainModel({ pluginId }, selection),
    );
  }

  createChildSession(
    pluginId: string,
    request: unknown,
  ): Promise<PluginCapabilityDispatchResult<unknown>> {
    return this.#dispatch(
      pluginId,
      { kind: "session.child.create" },
      () => this.#adapters.createChildSession({ pluginId }, request),
    );
  }

  readChildSession(
    pluginId: string,
    request: unknown,
  ): Promise<PluginCapabilityDispatchResult<unknown>> {
    return this.#dispatch(
      pluginId,
      { kind: "session.child.read" },
      () => this.#adapters.readChildSession({ pluginId }, request),
    );
  }

  publishChildSession(
    pluginId: string,
    request: unknown,
  ): Promise<PluginCapabilityDispatchResult<unknown>> {
    return this.#dispatch(
      pluginId,
      { kind: "session.child.publish" },
      () => this.#adapters.publishChildSession({ pluginId }, request),
    );
  }

  receiveSessionAttachments(
    pluginId: string,
    attachments: unknown,
  ): Promise<PluginCapabilityDispatchResult<unknown>> {
    return this.#dispatch(
      pluginId,
      { kind: "session.attachments.receive" },
      () => this.#adapters.receiveSessionAttachments({ pluginId }, attachments),
    );
  }

  listModels(pluginId: string): Promise<PluginCapabilityDispatchResult<unknown>> {
    return this.#dispatch(
      pluginId,
      { kind: "models.list" },
      () => this.#adapters.listModels({ pluginId }),
    );
  }

  selectModel(
    pluginId: string,
    selection: unknown,
  ): Promise<PluginCapabilityDispatchResult<unknown>> {
    return this.#dispatch(
      pluginId,
      { kind: "models.select" },
      () => this.#adapters.selectModel({ pluginId }, selection),
    );
  }

  invokeModel(
    pluginId: string,
    request: unknown,
  ): Promise<PluginCapabilityDispatchResult<unknown>> {
    return this.#dispatch(
      pluginId,
      { kind: "models.invoke" },
      () => this.#adapters.invokeModel({ pluginId }, request),
    );
  }

  listTools(pluginId: string): Promise<PluginCapabilityDispatchResult<unknown>> {
    return this.#dispatch(
      pluginId,
      { kind: "tools.list" },
      () => this.#adapters.listTools({ pluginId }),
    );
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
