import { defaultPeople } from "./data.js";

/** 円の文字から数字を取り出す。空なら null */
export function parseYen(raw) {
  const text = String(raw ?? "").replace(/[,円\s]/g, "");
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return n;
}

/** 数字を 1,234円 の形にする */
export function formatYen(n) {
  return `${Math.round(n).toLocaleString("ja-JP")}円`;
}

/** 記入済みの金額だけ足す */
export function filledSum(items) {
  const nums = items
    .map((item) => parseYen(item.amount))
    .filter((n) => n != null && !Number.isNaN(n));
  return { sum: nums.reduce((a, b) => a + b, 0), known: nums.length > 0 };
}

/** 未記入または不正な行があるか */
export function hasBlank(items) {
  if (items.length === 0) return true;
  return items.some((item) => parseYen(item.amount) == null);
}

/** 月額を年額にする。未記入なら null */
export function toYear(monthly) {
  if (monthly == null || Number.isNaN(monthly)) return null;
  return monthly * 12;
}

/** 父と母を足す。どちらも空なら昔の1欄 */
function pairYen(father, mother, fallback) {
  const nums = [parseYen(father), parseYen(mother)].filter((n) => n != null && !Number.isNaN(n));
  if (nums.length) return nums.reduce((a, b) => a + b, 0);
  const old = parseYen(fallback);
  if (old == null || Number.isNaN(old)) return null;
  return old;
}

/** 介護者ごとの欄を足す。なければ昔の父・母欄 */
function sumPersonField(costs, field) {
  const map = costs[field];
  if (map && typeof map === "object") {
    const nums = Object.values(map)
      .map((raw) => parseYen(raw))
      .filter((n) => n != null && !Number.isNaN(n));
    if (nums.length) return nums.reduce((a, b) => a + b, 0);
  }
  const fallback = typeof map === "string" ? map : "";
  if (field === "care") return pairYen(costs.careFather, costs.careMother, fallback || costs.care);
  if (field === "medical") return pairYen(costs.medicalFather, costs.medicalMother, fallback || costs.medical);
  if (field === "funeral") return pairYen(costs.funeralFather, costs.funeralMother, fallback || costs.funeral);
  return null;
}

/** これからかかる費用（月）を集計する */
export function monthlyCosts(costs) {
  const living = parseYen(costs.living);
  const care = sumPersonField(costs, "care");
  const medical = sumPersonField(costs, "medical");
  const values = [living, care, medical];
  const nums = values.filter((n) => n != null && !Number.isNaN(n));
  return {
    living,
    care,
    medical,
    sum: nums.reduce((a, b) => a + b, 0),
    known: nums.length > 0,
    blank: values.some((n) => n == null || Number.isNaN(n))
  };
}

/** 今あるお金の合計を作る */
export function makeSummary(data) {
  const savings = filledSum(data.savings || []);
  const insurance = filledSum(data.insurance || []);
  const investment = filledSum(data.investment || []);
  const house = filledSum(data.house || []);
  const workplace = filledSum(data.workplace || []);
  const loans = filledSum(data.loans || []);
  const pension = filledSum(data.pension || []);
  const other = filledSum(data.other || []);
  const assets = {
    sum: savings.sum + insurance.sum + investment.sum + house.sum + workplace.sum + other.sum,
    known: savings.known || insurance.known || investment.known || house.known || workplace.known || other.known
  };
  const cash = {
    sum: savings.sum + insurance.sum + investment.sum + other.sum,
    known: savings.known || insurance.known || investment.known || other.known
  };
  const blank =
    hasBlank(data.savings || []) ||
    hasBlank(data.insurance || []) ||
    hasBlank(data.investment || []) ||
    hasBlank(data.house || []) ||
    hasBlank(data.workplace || []) ||
    hasBlank(data.loans || []) ||
    hasBlank(data.pension || []);
  return { assets, cash, house, workplace, loans, pension, blank };
}

/** 年ごとの費用表を作る（毎年同じ金額） */
export function yearRows(costs) {
  const years = Number(costs.years) || 10;
  const m = monthlyCosts(costs);
  const living = toYear(m.living);
  const care = toYear(m.care);
  const medical = toYear(m.medical);
  const parts = [living, care, medical].filter((n) => n != null);
  const total = parts.length ? parts.reduce((a, b) => a + b, 0) : null;
  return Array.from({ length: years }, (_, i) => ({
    year: i + 1,
    living,
    care,
    medical,
    total
  }));
}

/** 見る年数のあいだの、暮らし・介護・病院の不足。年金は差し引く */
export function periodShort(summary, costs, years) {
  const m = monthlyCosts(costs);
  if (!m.known) return { amount: null, pensionBlank: false };
  const out = m.sum * 12 * years;
  if (!summary.pension.known) return { amount: out, pensionBlank: true };
  const income = summary.pension.sum * 12 * years;
  return { amount: Math.max(0, out - income), pensionBlank: false };
}

/** これまでの援助 1行の累計。毎月なら 月額×12×年数 */
export function pastRowTotal(row) {
  const amount = validYen(row && row.amount);
  if (amount == null) return null;
  if (!row || row.kind !== "monthly") return amount;
  const years = Number(row.years);
  if (!Number.isFinite(years) || years <= 0) return null;
  return amount * 12 * years;
}

/** これまでの援助を、妻の実家・夫の実家で合計する */
export function pastTotals(list = []) {
  const sum = { wife: 0, husband: 0 };
  const known = { wife: false, husband: false };
  list.forEach((row) => {
    const total = pastRowTotal(row);
    if (total == null) return;
    const side = row.side === "husband" ? "husband" : "wife";
    sum[side] += total;
    known[side] = true;
  });
  return {
    wife: sum.wife,
    husband: sum.husband,
    known,
    any: known.wife || known.husband,
    diff: sum.wife - sum.husband
  };
}

/** 使える数字だけ返す。空や不正は null */
export function validYen(raw) {
  const n = parseYen(raw);
  if (n == null || Number.isNaN(n)) return null;
  return n;
}

/** 分け方の重みを、人数に合わせて作る */
function splitWeights(count, mode) {
  if (mode === "sonMore") return Array.from({ length: count }, (_, i) => (i === 0 ? 2 : 1));
  if (mode === "sonMost") return Array.from({ length: count }, (_, i) => (i === 0 ? 8 : 1));
  return Array.from({ length: count }, () => 1);
}

/** 出せる人の重みで、不足額を分ける（1円単位） */
export function splitShares(parentShort, pays, mode) {
  if (parentShort == null) return pays.map(() => null);
  const base = splitWeights(pays.length, mode);
  const used = base.map((w, i) => (pays[i] ? w : 0));
  const total = used.reduce((a, b) => a + b, 0);
  if (total === 0) return pays.map(() => 0);
  const raw = used.map((w) => (parentShort * w) / total);
  const floors = raw.map((n) => Math.floor(n));
  let leftover = parentShort - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((n, i) => ({ i, frac: n - Math.floor(n), pay: pays[i] }))
    .filter((x) => x.pay)
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  order.forEach((x) => {
    if (leftover <= 0) return;
    floors[x.i] += 1;
    leftover -= 1;
  });
  return floors;
}

/** 1人分の負担と、用意できる額をまとめる */
function personNeed(title, share, cash) {
  return { title, share, cash, need: share };
}

/** 保存されている兄弟。なければ初期の3人 */
function peopleList(data) {
  if (data.people && data.people.length) return data.people;
  return defaultPeople();
}

/** 援助する人の配列を作る */
function helpPays(helpRow, people) {
  const row = helpRow || {};
  return people.map((person) => row[person.id] !== "no");
}

/** その項目で、その人が用意できる額 */
function helpReadyCash(row, person) {
  if (!row || row[person.id] === "no") return null;
  return validYen(row[`${person.id}Cash`]);
}

/** 4項目の用意できる額を足す。なければ昔の合計欄 */
function personHelpCash(help, person, fallback) {
  const nums = Object.keys(help || {})
    .map((id) => helpReadyCash(help[id], person))
    .filter((n) => n != null);
  if (nums.length) return nums.reduce((a, b) => a + b, 0);
  return fallback;
}

/** 自分で足した項目を、足りるかの題目にする */
function extraTopics(data) {
  const costs = (data.extras && data.extras.costs) || [];
  const help = (data.extras && data.extras.help) || [];
  const fromCosts = costs.map((item) => ({
    id: item.id,
    title: item.label || "その他",
    amount: validYen(item.amount)
  }));
  const used = new Set(fromCosts.map((item) => item.id));
  const fromHelp = help
    .filter((item) => !used.has(item.id))
    .map((item) => ({
      id: item.id,
      title: item.title || "その他",
      amount: validYen(item.amount)
    }));
  return fromCosts.concat(fromHelp);
}

/** 手元資金に、売る前提の仕事場・家を足す */
function salePool(summary, costs) {
  const useWorkplace = costs.useWorkplace !== "no";
  const useHouse = costs.useHouse === "yes";
  const cash = summary.cash.known ? summary.cash.sum : 0;
  const workplace = useWorkplace && summary.workplace.known ? summary.workplace.sum : 0;
  const house = useHouse && summary.house.known ? summary.house.sum : 0;
  return {
    cash,
    workplace,
    house,
    useWorkplace,
    useHouse,
    total: cash + workplace + house,
    known: summary.cash.known || (useWorkplace && summary.workplace.known) || (useHouse && summary.house.known)
  };
}

/** 親の資金を、介護→葬式→借金→片づけの順で充てる */
function applyParentMoney(topics, pool) {
  let left = pool;
  return topics.map((item) => {
    const amount = item.amount;
    if (amount == null) return { ...item, covered: 0, remain: null };
    const covered = Math.min(left, amount);
    left -= covered;
    return { ...item, covered, remain: amount - covered };
  });
}

/** 親の資金を先に使い、残りを援助する兄弟で分ける */
export function makeNeed(data) {
  const summary = makeSummary(data);
  const costs = monthlyCosts(data.costs);
  const years = Number(data.costs.years) || 10;
  const funeral = sumPersonField(data.costs, "funeral");
  const cleanup = validYen(data.costs.cleanup);
  const sonCash = validYen(data.costs.sonCash);
  const splitMode = data.costs.splitMode || "equal";
  const help = data.help || {};
  const people = peopleList(data);
  const cashFallback = {
    son: sonCash,
    daughter1: validYen(data.costs.daughter1Cash),
    daughter2: validYen(data.costs.daughter2Cash)
  };
  const period = periodShort(summary, data.costs, years);
  const topics = [
    { id: "care", title: "介護・暮らし", amount: period.amount },
    { id: "funeral", title: "葬式", amount: funeral },
    { id: "loans", title: "借金", amount: summary.loans.known ? summary.loans.sum : null },
    { id: "cleanup", title: "家の片づけ", amount: cleanup },
    ...extraTopics(data)
  ];
  const pool = salePool(summary, data.costs);
  const items = applyParentMoney(topics, pool.total).map((item) => {
    const pays = helpPays(help[item.id], people);
    return {
      ...item,
      pays,
      helpers: pays.filter(Boolean).length,
      shares: splitShares(item.remain, pays, splitMode),
      readyCash: people.map((person) => helpReadyCash(help[item.id], person))
    };
  });
  const siblingShare = people.map((_, i) =>
    items.reduce((sum, item) => sum + (item.shares[i] || 0), 0)
  );
  const known = items.some((item) => item.amount != null) && pool.known;
  const parentShort = items.reduce((sum, item) => sum + (item.remain || 0), 0);
  return {
    ready: known,
    yearlyIn: summary.pension.known ? summary.pension.sum * 12 : null,
    yearlyOut: costs.known ? costs.sum * 12 : null,
    years,
    funeral,
    sonCash,
    cash: summary.cash,
    house: summary.house,
    workplace: summary.workplace,
    pool,
    items,
    parentShort: known ? parentShort : null,
    splitMode,
    people: people.map((person, i) =>
      personNeed(person.title || "名前なし", siblingShare[i], personHelpCash(help, person, cashFallback[person.id]))
    ),
    costBlank: costs.blank,
    pensionBlank: period.pensionBlank
  };
}
