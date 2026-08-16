import { makeSummary, yearRows, makeNeed, parseYen } from "../js/calc.js";

function assert(name, cond) {
  if (!cond) throw new Error(name);
  console.log("ok", name);
}

assert("空は null", parseYen("") == null);
assert("カンマ付き", parseYen("1,200,000") === 1200000);

const data = {
  savings: [{ amount: "3000000" }],
  pension: [{ amount: "150000" }],
  insurance: [{ amount: "800000" }],
  house: [{ amount: "15000000" }],
  loans: [],
  costs: {
    living: "150000",
    care: "80000",
    medical: "20000",
    funeral: "2000000",
    exam: "1000000",
    ownCash: "500000",
    years: 10
  }
};

const summary = makeSummary(data);
assert("今あるお金に家と保険が入る", summary.assets.sum === 3000000 + 800000 + 15000000);
assert("足りるか用の現金に家は入らない", summary.cash.sum === 3000000 + 800000);

const rows = yearRows(data.costs);
assert("10年分", rows.length === 10);
assert("毎年同じ", rows[0].total === (150000 + 80000 + 20000) * 12);

const need = makeNeed(data);
assert("年収は年金×12", need.yearlyIn === 150000 * 12);
assert("不足は親の現金から出す", need.parentShort > 0);
assert("家を足しても長男負担は増えない", need.sonAll === need.parentShort);
assert("3人なら長男の不足は1/3", need.each === need.parentShort / 3);
assert("受験は長男の合計に足す", need.sonAllWithExam === need.parentShort + 1000000);

console.log("all passed");
