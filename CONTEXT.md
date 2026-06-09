# 句画 Context

This context names the product concepts for 句画, a lightweight site that turns a sentence and illustration into a shareable visual artifact.

## Language

**图文卡片**:
A single shareable vertical visual artifact composed of one **随机短句** and one **非署名绘本风** illustration. Users can refresh the content and download or share the resulting card.
_Avoid_: 文章, 收藏项, 打卡记录

**一言**:
A source sentence fetched from Hitokoto and used as the textual half of a **图文卡片**.
_Avoid_: 文案, 文章, 用户输入

**图文绑定**:
The product relationship where exactly one canonical illustration belongs to a specific **一言** under the current card shape and style version. The illustration is not an independent gallery asset.
_Avoid_: 一言多图, 随机配图池, 独立图库

**刷新生成**:
The user action of requesting a new **图文卡片** during the same visit, replacing both the sentence and its illustration. It does not imply an account, saved history, or permanent collection.
_Avoid_: 只换句子, 打卡, 投稿, 收藏

**随机短句**:
A 6–30 character sentence fetched from Hitokoto with no content-tone filtering beyond the chosen API parameters. It may be gentle, literary, humorous, or context-dependent; the product does not guarantee a healing textual tone.
_Avoid_: 治愈短句, 人工精选, 内容审核句

**非署名绘本风**:
A consistent illustration language described by visual traits rather than by naming a living artist: gentle watercolor picture-book feeling, low saturation, generous whitespace, small human figures, city or nature motifs, fine lines, and a lonely-but-healing mood.
_Avoid_: 几米风格, 临摹某画家, 用户任意风格

## Example dialogue

Dev: “用户刷新生成后，要不要把之前的图文卡片保存在账号里？”
Domain expert: “不要。刷新生成只代表当前访问中换一张图文卡片；下载或分享才是用户保存结果的方式。”
