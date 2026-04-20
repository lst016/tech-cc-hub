import type { ApiConfigProfile } from "../../types";
import { buildRoutingSummary } from "./settings-utils";

type OverviewSettingsPageProps = {
  profiles: ApiConfigProfile[];
  enabledProfile?: ApiConfigProfile;
};

type OverviewCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  meta: string;
};

function OverviewCard({ eyebrow, title, description, meta }: OverviewCardProps) {
  return (
    <div className="rounded-[28px] border border-ink-900/8 bg-white/88 p-5 shadow-[0_20px_48px_rgba(24,32,46,0.08)]">
      <div className="text-[11px] font-semibold tracking-[0.18em] text-muted">{eyebrow}</div>
      <div className="mt-3 text-base font-semibold text-ink-900">{title}</div>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      <div className="mt-4 rounded-2xl border border-ink-900/8 bg-surface px-4 py-3 text-xs leading-6 text-ink-700">
        {meta}
      </div>
    </div>
  );
}

export function OverviewSettingsPage({ profiles, enabledProfile }: OverviewSettingsPageProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="grid gap-4">
        <OverviewCard
          eyebrow="API"
          title="接口配置"
          description="把网关、密钥和模型池放在一个独立页面里管理，后面继续扩展鉴权、限流、供应商配置也可以直接沿这一页加。"
          meta={`共 ${profiles.length} 个配置，当前启用：${enabledProfile?.name || "未命名配置"}`}
        />
        <OverviewCard
          eyebrow="ROLES"
          title="模型分工"
          description="把主模型、工具模型、图像识别模型和专家模型拆成单独页面，后续继续加审稿模型、总结模型、路由策略也不需要重写外壳。"
          meta={buildRoutingSummary(enabledProfile)}
        />
      </div>

      <div className="rounded-[28px] border border-ink-900/8 bg-white/82 p-5 shadow-[0_20px_48px_rgba(24,32,46,0.08)]">
        <div className="text-[11px] font-semibold tracking-[0.18em] text-muted">当前启用</div>
        <div className="mt-3 text-lg font-semibold text-ink-900">{enabledProfile?.name || "未命名配置"}</div>
        <div className="mt-2 text-sm leading-6 text-muted">
          {enabledProfile
            ? `接口地址：${enabledProfile.baseURL || "未填写"}`
            : "还没有可用配置。"}
        </div>

        <div className="mt-5 grid gap-3">
          <div className="rounded-2xl border border-ink-900/8 bg-surface px-4 py-3">
            <div className="text-xs font-medium text-muted">主模型</div>
            <div className="mt-1 text-sm font-semibold text-ink-900">{enabledProfile?.model || "-"}</div>
          </div>
          <div className="rounded-2xl border border-ink-900/8 bg-surface px-4 py-3">
            <div className="text-xs font-medium text-muted">模型分工摘要</div>
            <div className="mt-1 text-sm leading-6 text-ink-800">{buildRoutingSummary(enabledProfile)}</div>
          </div>
          <div className="rounded-2xl border border-accent/14 bg-[linear-gradient(180deg,rgba(255,244,239,0.92),rgba(255,255,255,0.98))] px-4 py-3 text-sm leading-6 text-ink-700">
            现在这个设置已经不是为当前两页硬写的单体弹窗了，而是通用容器 + 独立页面。后面要扩展组件，优先沿页面和区块扩，不要再把结构揉回一个文件里。
          </div>
        </div>
      </div>
    </div>
  );
}
