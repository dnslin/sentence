# 句画

句画是一个轻量产品原型：把一句随机短句和一幅非署名绘本风画面组合成可分享的图文卡片。

## 本地启动

使用一个命令启动开发服务器：

```bash
pnpm dev
```

启动后打开：

- 首页 shell: http://localhost:3000
- 原型比较: http://localhost:3000/prototype

## 原型变体

`/prototype` 是 Slice 01 的抛弃式 UI 原型路由，可通过 `?variant=` 比较三个方向：

- `quiet-gallery`
- `immersive-stage`
- `paper-desk`

缺失、无效或重复的 `variant` 会回退到 `quiet-gallery`。

## shadcn UI 组件

项目使用 shadcn UI 作为可复用组件来源。新增组件时，先通过 CLI 生成到 `components/ui/`：

```bash
pnpm dlx shadcn@latest add button
```

在页面或组件中从本地文件导入生成后的 primitive：

```tsx
import { Button } from "@/components/ui/button"
```

优先复用已有 primitive；例如链接型 CTA 使用 `Button` 的 `asChild` 包裹 Next.js `Link`，避免重复焦点和交互样式。
