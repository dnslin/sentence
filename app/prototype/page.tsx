import Link from "next/link"

const variantIds = ["quiet-gallery", "immersive-stage", "paper-desk"] as const

type VariantId = (typeof variantIds)[number]

type SearchParams = Promise<{
  variant?: string | string[]
}>

type Variant = {
  id: VariantId
  name: string
  eyebrow: string
  sentence: string
  description: string
  actionNote: string
}

const variants: Record<VariantId, Variant> = {
  "quiet-gallery": {
    id: "quiet-gallery",
    name: "Quiet Gallery",
    eyebrow: "安静画廊方向",
    sentence: "风停在窗边，像一封没有署名的信。",
    description: "单张居中的 4:5 图文卡片，保留平静留白；随机短句与非署名绘本风画面绑定在同一张卡片里。",
    actionNote: "动作行离开卡片，像画廊墙下的说明牌。",
  },
  "immersive-stage": {
    id: "immersive-stage",
    name: "Immersive Stage",
    eyebrow: "沉浸舞台方向",
    sentence: "夜色把城市推远，只留一盏灯陪你走。",
    description: "更大的舞台视觉先占据视线，随机短句与图文卡片信息退到侧边，形成观演关系。",
    actionNote: "动作上下文贴近舞台边缘，而不是独立排在卡片下方。",
  },
  "paper-desk": {
    id: "paper-desk",
    name: "Paper Desk",
    eyebrow: "纸面桌案方向",
    sentence: "纸角微微卷起，春天从铅笔线里醒来。",
    description: "桌面、便签和纸张层叠成一组静物；图文卡片像被放在工作台上等待整理。",
    actionNote: "动作像桌面工具贴纸，与前两种画廊或舞台结构明显不同。",
  },
}

function getSelectedVariant(value: string | string[] | undefined): VariantId {
  if (typeof value !== "string") {
    return "quiet-gallery"
  }

  return variantIds.includes(value as VariantId) ? (value as VariantId) : "quiet-gallery"
}

export default async function PrototypePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const selectedId = getSelectedVariant(params.variant)
  const variant = variants[selectedId]
  const showSwitcher = process.env.NODE_ENV !== "production"

  return (
    <>
      <main className="min-h-svh bg-[#f7f2ea] px-6 py-10 text-stone-900 sm:px-10">
        <section className="mx-auto flex max-w-6xl flex-col gap-10" aria-labelledby="prototype-title">
          <header className="max-w-3xl space-y-4">
            <p className="text-sm font-medium tracking-[0.28em] text-stone-500 uppercase">句画 · 原型比较</p>
            <div className="space-y-3">
              <h1 id="prototype-title" className="text-3xl font-semibold tracking-tight sm:text-5xl">
                {variant.name}
              </h1>
              <p className="text-base leading-8 text-stone-600 sm:text-lg">
                这个抛弃式原型用本地静态数据比较三种公开体验方向：图文卡片、随机短句、非署名绘本风。
              </p>
            </div>
          </header>

          <VariantView variant={variant} />
        </section>
      </main>

      {showSwitcher ? <PrototypeSwitcher selectedId={selectedId} /> : null}
    </>
  )
}

function VariantView({ variant }: { variant: Variant }) {
  if (variant.id === "immersive-stage") {
    return <ImmersiveStage variant={variant} />
  }

  if (variant.id === "paper-desk") {
    return <PaperDesk variant={variant} />
  }

  return <QuietGallery variant={variant} />
}

function QuietGallery({ variant }: { variant: Variant }) {
  return (
    <article aria-label="Quiet Gallery 图文卡片" className="grid gap-8 lg:grid-cols-[1fr_18rem] lg:items-end">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6">
        <div className="aspect-[4/5] w-full rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex h-full flex-col justify-between rounded-[1.5rem] bg-gradient-to-b from-amber-50 to-stone-100 p-6">
            <div className="space-y-3">
              <p className="text-sm text-stone-500">{variant.eyebrow}</p>
              <h2 className="text-2xl font-semibold">一张安静的图文卡片</h2>
            </div>
            <div className="mx-auto h-40 w-40 rounded-full bg-[radial-gradient(circle_at_50%_35%,#f4d8a6,transparent_35%),linear-gradient(160deg,#d6e2d0,#f8efe0)]" />
            <p className="text-xl leading-9 text-stone-700">“{variant.sentence}”</p>
          </div>
        </div>
        <div className="flex w-full justify-center gap-3 border-t border-stone-300 pt-5 text-sm text-stone-600" aria-label="Quiet Gallery 独立动作行">
          <span>主动作位置</span>
          <span aria-hidden="true">·</span>
          <span>辅助动作位置</span>
        </div>
      </div>
      <VariantNotes variant={variant} />
    </article>
  )
}

function ImmersiveStage({ variant }: { variant: Variant }) {
  return (
    <article aria-label="Immersive Stage 舞台原型" className="grid gap-6 rounded-[2rem] bg-stone-950 p-5 text-stone-50 shadow-xl lg:grid-cols-[1fr_20rem]">
      <div className="min-h-[28rem] rounded-[1.5rem] bg-[radial-gradient(circle_at_50%_25%,#f6d28f,transparent_18%),linear-gradient(140deg,#1c2740,#586f68_55%,#dbc7a4)] p-8">
        <p className="text-sm tracking-[0.24em] text-stone-200 uppercase">{variant.eyebrow}</p>
        <div className="mt-32 max-w-lg rounded-3xl bg-black/25 p-6 backdrop-blur-sm">
          <h2 className="text-3xl font-semibold">沉浸舞台上的句画</h2>
          <p className="mt-4 text-2xl leading-10">“{variant.sentence}”</p>
        </div>
      </div>
      <aside className="flex flex-col justify-between gap-8 rounded-[1.5rem] border border-white/15 p-6">
        <VariantNotes variant={variant} inverted />
        <div className="grid gap-3 text-sm text-stone-300" aria-label="舞台边缘动作区">
          <span>靠近舞台的主动作位置</span>
          <span>侧栏辅助动作位置</span>
        </div>
      </aside>
    </article>
  )
}

function PaperDesk({ variant }: { variant: Variant }) {
  return (
    <article aria-label="Paper Desk 桌案原型" className="rounded-[2rem] bg-[#ded0ba] p-6 shadow-inner">
      <div className="grid gap-6 lg:grid-cols-[14rem_1fr_13rem] lg:items-center">
        <aside className="rotate-[-3deg] rounded-3xl bg-yellow-100 p-5 text-sm leading-7 text-stone-700 shadow-md">
          {variant.actionNote}
        </aside>
        <div className="relative mx-auto w-full max-w-lg rounded-[2rem] bg-white p-8 shadow-2xl before:absolute before:-top-5 before:left-10 before:h-10 before:w-28 before:rotate-[-4deg] before:bg-white/55">
          <p className="text-sm text-stone-500">{variant.eyebrow}</p>
          <h2 className="mt-3 text-3xl font-semibold">桌面上的图文卡片</h2>
          <div className="my-8 h-48 rounded-[1.5rem] bg-[linear-gradient(135deg,#e8d8bd,#f8f4ea_45%,#cbd7c3)]" />
          <p className="text-2xl leading-10 text-stone-700">“{variant.sentence}”</p>
        </div>
        <VariantNotes variant={variant} />
      </div>
    </article>
  )
}

function VariantNotes({ variant, inverted = false }: { variant: Variant; inverted?: boolean }) {
  return (
    <section className="space-y-4" aria-label={`${variant.name} 说明`}>
      <p className={inverted ? "text-stone-300" : "text-stone-600"}>{variant.description}</p>
      <p className={inverted ? "text-sm text-stone-400" : "text-sm text-stone-500"}>{variant.actionNote}</p>
    </section>
  )
}

function PrototypeSwitcher({ selectedId }: { selectedId: VariantId }) {
  return (
    <nav
      aria-label="原型切换器"
      className="fixed right-4 bottom-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-stone-300 bg-white/95 p-4 text-sm text-stone-800 shadow-2xl backdrop-blur"
    >
      <p className="mb-3 font-medium">原型切换器（仅非生产环境）</p>
      <div className="grid gap-2">
        {variantIds.map((id) => (
          <Link
            key={id}
            href={`/prototype?variant=${id}`}
            aria-current={selectedId === id ? "page" : undefined}
            className="rounded-xl border border-stone-200 px-3 py-2 hover:bg-stone-100 aria-current:bg-stone-900 aria-current:text-white"
          >
            {variants[id].name}
          </Link>
        ))}
      </div>
    </nav>
  )
}
