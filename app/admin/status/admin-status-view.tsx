import type {
  OperationalStatus,
  RecentGenerationError,
  StorageIndicators,
} from "@/lib/admin/operational-status"

function formatBytes(byteLength: number): string {
  if (byteLength <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(byteLength) / Math.log(1024))
  )
  const value = byteLength / 1024 ** exponent
  const rounded = exponent === 0 ? value : Math.round(value * 10) / 10
  return `${rounded} ${units[exponent]}`
}

function CountCard({
  label,
  value,
  testId,
}: {
  label: string
  value: number
  testId: string
}) {
  return (
    <div
      data-testid={testId}
      className="rounded-lg border border-border bg-card p-4"
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function CountsSection({ counts }: { counts: OperationalStatus["counts"] }) {
  return (
    <section aria-labelledby="admin-status-counts-heading" className="space-y-3">
      <h2
        id="admin-status-counts-heading"
        className="text-lg font-medium"
      >
        库存与生成计数
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <CountCard
          label="就绪图文卡片"
          value={counts.ready}
          testId="admin-status-count-ready"
        />
        <CountCard
          label="进行中尝试"
          value={counts.inProgress}
          testId="admin-status-count-in-progress"
        />
        <CountCard
          label="失败尝试"
          value={counts.failed}
          testId="admin-status-count-failed"
        />
      </div>
    </section>
  )
}

function StorageSection({ storage }: { storage: StorageIndicators }) {
  return (
    <section
      aria-labelledby="admin-status-storage-heading"
      className="space-y-3"
    >
      <h2 id="admin-status-storage-heading" className="text-lg font-medium">
        存储指标
      </h2>
      <dl
        data-testid="admin-status-storage"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <div className="rounded-lg border border-border bg-card p-4">
          <dt className="text-sm text-muted-foreground">数据库</dt>
          <dd className="mt-1 text-sm">
            {storage.database.exists ? "已就绪" : "缺失"} ·{" "}
            {formatBytes(storage.database.byteLength)}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <dt className="text-sm text-muted-foreground">插画目录</dt>
          <dd className="mt-1 text-sm">
            {storage.generatedIllustrations.exists ? "已就绪" : "缺失"} ·{" "}
            {storage.generatedIllustrations.fileCount} 张 ·{" "}
            {formatBytes(storage.generatedIllustrations.byteLength)}
          </dd>
        </div>
      </dl>
    </section>
  )
}

function RecentErrorsSection({
  recentErrors,
}: {
  recentErrors: RecentGenerationError[]
}) {
  return (
    <section aria-labelledby="admin-status-errors-heading" className="space-y-3">
      <h2 id="admin-status-errors-heading" className="text-lg font-medium">
        最近生成错误
      </h2>
      {recentErrors.length === 0 ? (
        <p data-testid="admin-status-errors-empty" className="text-sm text-muted-foreground">
          暂无失败记录。
        </p>
      ) : (
        <ul data-testid="admin-status-errors" className="space-y-2">
          {recentErrors.map((error) => (
            <li
              key={error.attemptId}
              className="rounded-lg border border-border bg-card p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{error.stage ?? "未知阶段"}</span>
                <time className="text-xs text-muted-foreground">
                  {error.occurredAt}
                </time>
              </div>
              <p className="mt-1 text-muted-foreground">
                {error.message ?? "无错误信息"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function AdminStatusView({ status }: { status: OperationalStatus }) {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">运营状态</h1>
        <p className="text-sm text-muted-foreground">
          生成于 {status.generatedAt}
        </p>
      </header>
      <CountsSection counts={status.counts} />
      <RecentErrorsSection recentErrors={status.recentErrors} />
      <StorageSection storage={status.storage} />
    </main>
  )
}

export function AdminStatusUnauthorizedView() {
  return (
    <main
      data-testid="admin-status-unauthorized"
      className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4 text-center"
    >
      <h1 className="text-2xl font-semibold">未授权</h1>
      <p className="text-sm text-muted-foreground">
        运营状态仅对持有有效访问令牌的站点所有者开放。
      </p>
    </main>
  )
}
