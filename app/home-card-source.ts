export type CardMock = {
  sentence: string
  sceneLabel: string
  accent: "dawn" | "rain" | "moon"
}

export const mockCards: CardMock[] = [
  {
    sentence: "风停在窗边，像一封没有署名的信。",
    sceneLabel: "晨光里的窗边小路",
    accent: "dawn",
  },
  {
    sentence: "雨声很轻，把街角洗成新的颜色。",
    sceneLabel: "细雨中的安静街角",
    accent: "rain",
  },
  {
    sentence: "月亮落在山坡上，替夜晚留了一盏灯。",
    sceneLabel: "月光下的远山和小人",
    accent: "moon",
  },
]
