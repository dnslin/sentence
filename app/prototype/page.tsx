import { Suspense } from "react"

import { PrototypeExperience } from "./prototype-experience"

export default function PrototypePage() {
  return (
    <Suspense fallback={<PrototypeExperienceFallback />}>
      <PrototypeExperience />
    </Suspense>
  )
}

function PrototypeExperienceFallback() {
  return (
    <main className="min-h-svh bg-[#f7f2ea] px-6 py-10 text-stone-900 sm:px-10">
      <section className="mx-auto flex max-w-6xl flex-col gap-10" aria-labelledby="prototype-title">
        <header className="max-w-3xl space-y-4">
          <p className="text-sm font-medium tracking-[0.28em] text-stone-500 uppercase">句画 · 原型比较</p>
          <div className="space-y-3">
            <h1 id="prototype-title" className="text-3xl font-semibold tracking-tight sm:text-5xl">
              Quiet Gallery
            </h1>
            <p className="text-base leading-8 text-stone-600 sm:text-lg">
              这个抛弃式原型用本地静态数据比较三种公开体验方向：图文卡片、随机短句、非署名绘本风。
            </p>
          </div>
        </header>
      </section>
    </main>
  )
}
