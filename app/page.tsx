import Link from "next/link"

export default function Page() {
  return (
    <main className="flex min-h-svh items-center bg-[#f7f2ea] px-6 py-12 text-stone-900">
      <section className="mx-auto flex max-w-3xl flex-col gap-6">
        <p className="text-sm font-medium tracking-[0.28em] text-stone-500 uppercase">句画 · App Shell</p>
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">把随机短句放进一张图文卡片。</h1>
          <p className="max-w-2xl text-lg leading-8 text-stone-600">
            句画会把一句随机短句和非署名绘本风画面组合成可分享的图文卡片。当前切片只提供原型入口，不实现最终首页体验。
          </p>
        </div>
        <Link
          href="/prototype"
          className="w-fit rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-700"
        >
          查看 /prototype 原型
        </Link>
      </section>
    </main>
  )
}
