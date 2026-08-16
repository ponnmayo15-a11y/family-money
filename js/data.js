/** 一覧に出す項目と、調べ方のヒント */
export const CATEGORIES = [
  {
    id: "savings",
    title: "貯金",
    addLabel: "口座を足す",
    namePlaceholder: "例：みずほ銀行",
    amountPlaceholder: "例：1200000",
    hint: "通帳のいちばん新しい残高。ネット銀行なら、アプリの残高。",
    kind: "asset"
  },
  {
    id: "pension",
    title: "年金（月額）",
    addLabel: "年金を足す",
    namePlaceholder: "例：厚生年金",
    amountPlaceholder: "例：150000",
    hint: "誕生日月に届く「ねんきん定期便」。または「ねんきんネット」。",
    kind: "monthly"
  },
  {
    id: "insurance",
    title: "保険",
    addLabel: "保険を足す",
    namePlaceholder: "例：生命保険",
    amountPlaceholder: "例：800000",
    hint: "保険証券。解約したとき戻るお金（解約返戻金）が分かれば金額。わからなければ名前だけ。",
    kind: "asset"
  },
  {
    id: "house",
    title: "家や土地",
    addLabel: "物件を足す",
    namePlaceholder: "例：実家（持ち家）",
    amountPlaceholder: "例：15000000",
    hint: "固定資産税の通知書（毎年春ごろ）。書いてある評価額でOK。",
    kind: "asset"
  },
  {
    id: "loans",
    title: "借金・ローン",
    addLabel: "借入を足す",
    namePlaceholder: "例：住宅ローン",
    amountPlaceholder: "例：5000000",
    hint: "返済予定表、残高証明書、カードのアプリ。",
    kind: "debt"
  }
];

/** これからかかる費用（月額） */
export const COST_FIELDS = [
  {
    id: "living",
    title: "生活費（月）",
    placeholder: "例：150000",
    hint: "食費・光熱費・家賃など。通帳の引き出しからざっくりでOK。"
  },
  {
    id: "care",
    title: "介護費（月）",
    placeholder: "例：80000",
    hint: "まだ始まっていなくても、将来かかる想定で入れてOK。"
  },
  {
    id: "medical",
    title: "病院・医療費（月）",
    placeholder: "例：20000",
    hint: "薬代や通院。大きな入院は平均で入れてOK。"
  }
];

/** 兄弟の人数（長男1人 + 姉2人） */
export const SIBLING_COUNT = 3;

/** 保存データの初期値 */
export function emptyData() {
  return {
    savings: [],
    pension: [],
    insurance: [],
    house: [],
    loans: [],
    costs: { living: "", care: "", medical: "", funeral: "", exam: "", ownCash: "", years: 10 }
  };
}
