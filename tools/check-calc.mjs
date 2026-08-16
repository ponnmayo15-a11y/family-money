import { makeSummary, yearRows, makeNeed, parseYen, splitShares } from "../js/calc.js";

function assert(name, cond) {
  if (!cond) throw new Error(name);
  console.log("ok", name);
}

function noHelp(who) {
  const row = { son: "yes", daughter1: "yes", daughter2: "yes", [who]: "no" };
  return { care: { ...row }, funeral: { ...row }, loans: { ...row }, cleanup: { ...row } };
}

assert("空は null", parseYen("") == null);
assert("カンマ付き", parseYen("1,200,000") === 1200000);

const data = {
  savings: [{ amount: "3000000" }],
  pension: [{ amount: "150000" }],
  insurance: [{ amount: "800000" }],
  house: [{ amount: "15000000" }],
  workplace: [{ amount: "5000000" }],
  loans: [{ amount: "1000000" }],
  costs: {
    living: "150000",
    careFather: "80000",
    careMother: "60000",
    medicalFather: "20000",
    medicalMother: "10000",
    funeralFather: "2000000",
    funeralMother: "1800000",
    cleanup: "500000",
    exam: "1000000",
    sonCash: "500000",
    daughter1Cash: "300000",
    daughter2Cash: "200000",
    years: 10
  }
};

const summary = makeSummary(data);
assert("今あるお金に家と仕事場が入る", summary.assets.sum === 3000000 + 800000 + 15000000 + 5000000);
assert("手元資金に家と仕事場は入らない", summary.cash.sum === 3000000 + 800000);

const withInvest = makeSummary({ ...data, investment: [{ amount: "400000" }] });
assert("投資は今あるお金に入る", withInvest.assets.sum === summary.assets.sum + 400000);
assert("投資は手元資金に入る", withInvest.cash.sum === summary.cash.sum + 400000);

const rows = yearRows(data.costs);
assert("10年分", rows.length === 10);
assert("毎年同じ", rows[0].total === (150000 + 80000 + 60000 + 20000 + 10000) * 12);

const need = makeNeed(data);
assert("年収は年金×12", need.yearlyIn === 150000 * 12);
assert("葬式は父と母の合計", need.funeral === 2000000 + 1800000);
assert("仕事場は売る前提", need.pool.useWorkplace && need.pool.workplace === 5000000);
assert("家は売らない前提", !need.pool.useHouse && need.pool.house === 0);
assert("不足は親の現金と仕事場から出す", need.parentShort > 0);
assert("同じ額なら3等分", Math.abs(need.people[0].share - need.people[1].share) <= 1);
assert("3人の出す合計は残り", need.people[0].share + need.people[1].share + need.people[2].share === need.parentShort);
assert("3人の分担がある", need.people.length === 3);
assert("4項目ある", need.items.length === 4);

const onlySon = makeNeed({
  ...data,
  help: {
    care: { son: "yes", daughter1: "no", daughter2: "no" },
    funeral: { son: "yes", daughter1: "no", daughter2: "no" },
    loans: { son: "yes", daughter1: "no", daughter2: "no" },
    cleanup: { son: "yes", daughter1: "no", daughter2: "no" }
  }
});
assert("姉が援助しないなら長男が全部", onlySon.people[0].share === onlySon.parentShort);
assert("援助しない人は0円", onlySon.people[1].share === 0);

const more = makeNeed({ ...data, costs: { ...data.costs, splitMode: "sonMore" } });
assert("長男が多めなら約半分", Math.abs(more.people[0].share - more.parentShort / 2) <= 1);

const withHouse = makeNeed({ ...data, costs: { ...data.costs, useHouse: "yes" } });
assert("家を入れると売値が足される", withHouse.pool.house === 15000000);

const parts = splitShares(100, [true, false, true], "sonMore");
assert("出せない人を除いて重みで分ける", parts[0] + parts[2] === 100 && parts[1] === 0);

const withReady = makeNeed({
  ...data,
  help: {
    care: { son: "yes", daughter1: "yes", daughter2: "yes", sonCash: "100000" },
    funeral: { son: "yes", daughter1: "yes", daughter2: "yes" },
    loans: { son: "yes", daughter1: "yes", daughter2: "yes" },
    cleanup: { son: "yes", daughter1: "yes", daughter2: "yes" }
  }
});
assert("項目の用意額が長男に入る", withReady.people[0].cash === 100000);
assert("介護の用意額が見える", withReady.items[0].readyCash[0] === 100000);

const two = makeNeed({
  ...data,
  people: [
    { id: "a", title: "A" },
    { id: "b", title: "B" }
  ],
  help: {
    care: { a: "yes", b: "yes" },
    funeral: { a: "yes", b: "yes" },
    loans: { a: "yes", b: "yes" },
    cleanup: { a: "yes", b: "yes" }
  }
});
assert("2人なら人数が2", two.people.length === 2);
assert("2人なら半分", Math.abs(two.people[0].share - two.parentShort / 2) <= 1);

console.log("all passed");
