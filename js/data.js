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
    id: "investment",
    title: "投資",
    addLabel: "投資を足す",
    namePlaceholder: "例：NISA・株",
    amountPlaceholder: "例：2000000",
    hint: "今売ったら手元に残る金額。証券アプリの評価額でOK。空欄は足しません。",
    kind: "asset"
  },
  {
    id: "house",
    title: "家や土地",
    addLabel: "物件を足す",
    namePlaceholder: "例：実家（持ち家）",
    amountPlaceholder: "例：8000000",
    hint: "固定資産税の評価額ではなく、今いくらで売れそうか。不動産屋に聞いた値段でOK。",
    kind: "asset"
  },
  {
    id: "workplace",
    title: "仕事場",
    addLabel: "仕事場を足す",
    namePlaceholder: "例：店舗・工場",
    amountPlaceholder: "例：5000000",
    hint: "仕事場を実際に売ったら、いくらになりそうか。空欄なら計算に入れません。",
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
  },
  {
    id: "other",
    title: "その他",
    addLabel: "項目を足す",
    namePlaceholder: "例：現金・貸金庫",
    amountPlaceholder: "例：300000",
    hint: "上のどれにも入らない、今あるお金。空欄は足しません。",
    kind: "asset"
  }
];

/** これからかかる費用（月額） */
export const COST_FIELDS = [
  {
    id: "living",
    title: "生活費（月）",
    placeholder: "例：150000",
    hint: "食費・光熱費・家賃など。家の分なので1つ。"
  },
  {
    id: "careFather",
    title: "介護費・自分の父（月）",
    placeholder: "例：80000",
    hint: "自分の父の施設やヘルパー。"
  },
  {
    id: "careMother",
    title: "介護費・自分の母（月）",
    placeholder: "例：80000",
    hint: "自分の母の施設やヘルパー。"
  },
  {
    id: "medicalFather",
    title: "病院・自分の父（月）",
    placeholder: "例：20000",
    hint: "自分の父の薬代や通院。"
  },
  {
    id: "medicalMother",
    title: "病院・自分の母（月）",
    placeholder: "例：20000",
    hint: "自分の母の薬代や通院。"
  }
];

/** 最初に出す介護者 */
export function defaultCaregivers() {
  return [
    { id: "father", title: "自分の父" },
    { id: "mother", title: "自分の母" }
  ];
}

/** 1人分の介護・病院・葬式の空欄 */
export function emptyPersonCosts() {
  return { care: "", medical: "", funeral: "" };
}

/** 介護者ごとの費用マップ */
export function emptyCostMap(caregivers = defaultCaregivers()) {
  const map = {};
  caregivers.forEach((person) => {
    map[person.id] = "";
  });
  return map;
}

/** 最初に出す兄弟（自分の家の初期値） */
export function defaultPeople() {
  return [
    { id: "son", title: "長男" },
    { id: "daughter1", title: "長女" },
    { id: "daughter2", title: "次女" }
  ];
}

/** 兄弟に援助を聞く4つ */
export const HELP_ITEMS = [
  { id: "care", title: "介護", hint: "介護者全員の、施設やヘルパー。" },
  { id: "funeral", title: "葬式", hint: "介護者それぞれ1回分の合計。" },
  { id: "loans", title: "借金", hint: "親のローンや借金の残り。" },
  { id: "cleanup", title: "家の片づけ", hint: "遺品整理や家の片付け。" }
];

/** お金の分け方 */
export const SPLIT_MODES = [
  { id: "equal", title: "出せる人で同じ額", hint: "出せるとした人で、同じ金額ずつ。" },
  { id: "sonMore", title: "一番上が多め", hint: "一覧の一番上の人が、ほかの人の2倍。出せない人は0円。" },
  { id: "sonMost", title: "一番上がほぼ全部", hint: "一覧の一番上の人が8、ほかの人が1の割合。出せない人は0円。" }
];

/** 保存データの初期値 */
export function emptyData() {
  const people = defaultPeople();
  const caregivers = defaultCaregivers();
  return {
    savings: [],
    pension: [],
    insurance: [],
    investment: [],
    house: [],
    workplace: [],
    loans: [],
    other: [],
    people,
    caregivers,
    extras: { costs: [], help: [] },
    costs: {
      living: "",
      care: emptyCostMap(caregivers),
      medical: emptyCostMap(caregivers),
      funeral: emptyCostMap(caregivers),
      cleanup: "",
      exam: "",
      sonCash: "",
      daughter1Cash: "",
      daughter2Cash: "",
      splitMode: "equal",
      useWorkplace: "yes",
      useHouse: "no",
      years: 10
    },
    help: emptyHelp(people)
  };
}

/** 1項目の援助の初期値 */
export function emptyHelpRow(people = defaultPeople()) {
  const row = {};
  people.forEach((person) => {
    row[person.id] = "yes";
    row[`${person.id}Cash`] = "";
  });
  return row;
}

/** 援助の初期値（みんな援助する） */
export function emptyHelp(people = defaultPeople()) {
  return {
    care: emptyHelpRow(people),
    funeral: emptyHelpRow(people),
    loans: emptyHelpRow(people),
    cleanup: emptyHelpRow(people)
  };
}
