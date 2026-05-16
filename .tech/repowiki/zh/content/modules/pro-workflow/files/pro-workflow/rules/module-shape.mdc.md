# pro-workflow/rules/module-shape.mdc

> 模块：`pro-workflow` · 语言：`unknown` · 行数：66

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```unknown
---
description: Prefer modules with a narrow public surface and a thick internal implementation. Inject external dependencies at the boundary. Mock only at system edges.
globs:
alwaysApply: true
---

# Module Shape

## Surface vs. depth

A module's **surface** is every symbol a caller can touch: exported
functions, class methods, config parameters, flags. A module's **depth**
is everything hidden behind that surface: algorithms, branching, state
machines, retries, caching.

Aim for **narrow surface, thick depth**. A three-method module that hides
a hundred lines of branching is strong. A thirty-method module whose
methods each forward a single call to a dependency is weak — it leaks
complexity upward without doing work.

When adding a public export, first ask whether an existing one can absorb
the new behavior. When removing, first ask whether the module has gone
shallow and should be inlined into its only caller.

## Dependency direction

Accept dependencies as arguments. Do not construct external clients,
fetch configuration, or read the clock inside business logic.

```ts
// strong: the caller owns lifecycle, the test swaps the gateway
function chargeOrder(order, gateway) { return gateway.charge(order.total); }

// weak: business logic welds itself to a vendor and a credential source
function chargeOrder(order) {
  const gateway = new AcmePay(process.env.ACME_KEY);
  return gateway.charge(order.total);
}
```

Return values, do not mutate inputs. `computeDiscount(cart) -> Discount`
beats `applyDiscount(cart) -> void`. Pure returns are traceable; hidden
mutation is not.

## Where mocks belong

Mock at system boundaries only: third-party HTTP APIs, databases when a
real test instance is not available, the clock, random sources, the
filesystem when tests must stay hermetic.

Do not mock your own modules, internal classes, or anything you can
instantiate cheaply. A test whose setup is twenty lines of mock wiring is
telling you the module underneath is too shallow — fix the shape, not
the test.

At the real boundaries, prefer **endpoint-shaped** mocks over generic
ones. `{ getUser(id), createOrder(data) }` beats `{ request(path, opts) }`
because each mock returns one shape, test setup contains no conditionals,
and a reader can see which calls a test exercises.

## Checklist when reviewing

- [ ] Does every public symbol justify its presence? Delete or merge the rest.
- [ ] Are dependencies passed in, or constructed inside?
- [ ] Do tests mock anything the module itself owns? If yes, the shape is wrong.

```
