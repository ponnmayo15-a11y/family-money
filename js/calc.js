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
  return `${n.toLocaleString("ja-JP")}円`;
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

/** これからかかる費用（月）を集計する */
export function monthlyCosts(costs) {
  const living = parseYen(costs.living);
  const care = parseYen(costs.care);
  const medical = parseYen(costs.medical);
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
  const savings = filledSum(data.savings);
  const insurance = filledSum(data.insurance);
  const house = filledSum(data.house);
  const loans = filledSum(data.loans);
  const pension = filledSum(data.pension);
  const assets = {
    sum: savings.sum + insurance.sum + house.sum,
    known: savings.known || insurance.known || house.known
  };
  const cash = {
    sum: savings.sum + insurance.sum,
    known: savings.known || insurance.known
  };
  const blank =
    hasBlank(data.savings) ||
    hasBlank(data.insurance) ||
    hasBlank(data.house) ||
    hasBlank(data.loans) ||
    hasBlank(data.pension);
  return { assets, cash, loans, pension, blank };
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

/** 足りるかの数字を作る */
export function makeGap(data) {
  const summary = makeSummary(data);
  const costs = monthlyCosts(data.costs);
  const years = Number(data.costs.years) || 10;
  const yearlyIn = summary.pension.known ? summary.pension.sum * 12 : null;
  const yearlyOut = costs.known ? costs.sum * 12 : null;
  const ready = yearlyIn != null && yearlyOut != null;
  const yearly = ready ? yearlyIn - yearlyOut : null;
  return {
    ready,
    yearly,
    yearlyIn,
    yearlyOut,
    years,
    periodIn: yearlyIn != null ? yearlyIn * years : null,
    periodOut: yearlyOut != null ? yearlyOut * years : null,
    cash: summary.cash,
    cashYears: cashYears(yearly, summary.cash),
    leftoverShort: leftoverShort(yearly, years, summary.cash),
    costBlank: costs.blank
  };
}

/** 貯金・保険で何年持つか */
function cashYears(yearly, cash) {
  if (yearly == null || yearly >= 0 || !cash.known) return null;
  if (yearly === 0) return null;
  return cash.sum / -yearly;
}

/** 見通し期間のあと、まだ足りない額 */
function leftoverShort(yearly, years, cash) {
  if (yearly == null || yearly >= 0 || !cash.known) return null;
  return Math.max(0, -yearly * years - cash.sum);
}

/** 使える数字だけ返す。空や不正は null */
export function validYen(raw) {
  const n = parseYen(raw);
  if (n == null || Number.isNaN(n)) return null;
  return n;
}

/** 不足額に受験費用を足す。受験が空なら不足額だけ */
function addExam(base, exam) {
  if (base == null) return null;
  if (exam == null) return base;
  return base + exam;
}

/** 親の不足と、長男・3人分担を出す */
export function makeNeed(data) {
  const summary = makeSummary(data);
  const costs = monthlyCosts(data.costs);
  const years = Number(data.costs.years) || 10;
  const yearlyIn = summary.pension.known ? summary.pension.sum * 12 : null;
  const yearlyOut = costs.known ? costs.sum * 12 : null;
  const funeral = validYen(data.costs.funeral);
  const exam = validYen(data.costs.exam);
  const ownCash = validYen(data.costs.ownCash);
  const ready = yearlyIn != null && yearlyOut != null && summary.cash.known;
  const net = ready
    ? yearlyIn * years + summary.cash.sum - (yearlyOut * years + (funeral ?? 0))
    : null;
  const parentShort = net == null ? null : Math.max(0, -net);
  const each = parentShort == null ? null : parentShort / 3;
  return {
    ready,
    yearlyIn,
    yearlyOut,
    years,
    funeral,
    exam,
    ownCash,
    cash: summary.cash,
    parentShort,
    parentLeft: net == null ? null : Math.max(0, net),
    sonAll: parentShort,
    each,
    sonAllWithExam: addExam(parentShort, exam),
    sonSplitWithExam: addExam(each, exam),
    costBlank: costs.blank
  };
}
