import { CATEGORIES, SPLIT_MODES, HELP_ITEMS, emptyData, emptyHelp, emptyHelpRow, defaultPeople, defaultCaregivers, emptyCostMap } from "./data.js";
import { parseYen, formatYen, makeSummary, yearRows, makeNeed, monthlyCosts } from "./calc.js";

const STORAGE_KEY = "family-money-v1";
const MAX_PEOPLE = 8;

/** 保存データを読み出す */
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    const people = migratePeople(parsed);
    const caregivers = migrateCaregivers(parsed);
    return {
      ...emptyData(),
      ...parsed,
      people,
      caregivers,
      other: parsed.other || [],
      investment: parsed.investment || [],
      extras: {
        costs: (parsed.extras && parsed.extras.costs) || [],
        help: (parsed.extras && parsed.extras.help) || []
      },
      workplace: parsed.workplace || [],
      costs: migrateCosts({ ...emptyData().costs, ...(parsed.costs || {}) }, caregivers),
      help: migrateHelp(parsed, people)
    };
  } catch {
    return emptyData();
  }
}

/** 入力をこの端末に保存する */
function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** 金額の表示用テキストを返す */
function moneyText(part, suffix = "") {
  if (!part.known) return { text: "まだわからない", blank: true };
  return { text: formatYen(part.sum) + suffix, blank: false };
}

/** 未記入や不正な金額の表示 */
function yenOrBlank(n, suffix = "") {
  if (n == null) return "まだわからない";
  if (Number.isNaN(n)) return "数字を入れてください";
  return formatYen(n) + suffix;
}

/** 昔の1欄を、介護者ごとの欄へ移す */
function migrateCosts(costs, caregivers) {
  if (!costs.sonCash && costs.ownCash) costs.sonCash = costs.ownCash;
  ["care", "medical", "funeral"].forEach((field) => {
    const fatherKey = `${field}Father`;
    const motherKey = `${field}Mother`;
    if (!costs[field] || typeof costs[field] !== "object") {
      const old = typeof costs[field] === "string" ? costs[field] : "";
      costs[field] = emptyCostMap(caregivers);
      if (old && costs[field].father != null) costs[field].father = old;
    }
    caregivers.forEach((person) => {
      if (costs[field][person.id] == null) costs[field][person.id] = "";
    });
    if (!costs[field].father && costs[fatherKey]) costs[field].father = costs[fatherKey];
    if (!costs[field].mother && costs[motherKey]) costs[field].mother = costs[motherKey];
    if (field === "care" && !costs[field].father && costs.care && typeof costs.care === "string") {
      costs[field].father = costs.care;
    }
  });
  return costs;
}

/** 介護者の人数を、欠けない形に整える */
function migrateCaregivers(parsed) {
  if (Array.isArray(parsed.caregivers) && parsed.caregivers.length) {
    return parsed.caregivers.map((person, i) => ({
      id: String(person.id || `c-${i}`),
      title: String(person.title ?? "")
    }));
  }
  return defaultCaregivers();
}

/** 兄弟の人数を、欠けない形に整える */
function migratePeople(parsed) {
  if (Array.isArray(parsed.people) && parsed.people.length) {
    return parsed.people.map((person, i) => ({
      id: String(person.id || `p-${i}`),
      title: String(person.title ?? "")
    }));
  }
  return defaultPeople();
}

/** 援助の保存を、欠けない形に整える */
function migrateHelp(parsed, people) {
  const help = emptyHelp(people);
  if (parsed.help) {
    Object.keys(help).forEach((key) => {
      help[key] = { ...help[key], ...(parsed.help[key] || {}) };
    });
  }
  people.forEach((person, i) => {
    const old = ["sonPay", "daughter1Pay", "daughter2Pay"][i];
    if (parsed.costs && parsed.costs[old] === "no") {
      Object.keys(help).forEach((key) => {
        help[key][person.id] = "no";
      });
    }
  });
  return help;
}

let state = loadData();
let openCat = "";

/** 押したページだけ開く */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.toggle("is-on", el.id === id));
  if (id === "screen-own") {
    renderHelp();
    fillHelpCash();
  }
  if (id === "screen-gap") renderGap();
  window.scrollTo(0, 0);
}

/** 項目の記入状況を短く返す */
function catStatus(items) {
  if (!items.length) return "まだない";
  const filled = items.filter((item) => {
    const n = parseYen(item.amount);
    return n != null && !Number.isNaN(n);
  }).length;
  return `${filled}件記入`;
}

/** 1つの項目行のHTMLを作る */
function rowHtml(cat, item) {
  const n = parseYen(item.amount);
  const bad = Number.isNaN(n);
  const blank = n == null;
  const status = bad ? "数字を入れてください" : blank ? "まだわからない" : "記入済み";
  return `
    <div class="row" data-cat="${cat.id}" data-id="${item.id}">
      <label>名前</label>
      <input data-field="label" value="${escapeHtml(item.label)}" placeholder="${cat.namePlaceholder}">
      <label>金額（円）</label>
      <input data-field="amount" inputmode="numeric" class="${bad ? "is-bad" : ""}" value="${escapeHtml(item.amount)}" placeholder="${cat.amountPlaceholder}">
      ${bad ? '<p class="err">半角の数字で入れてください</p>' : ""}
      <div class="row-foot">
        <span class="status ${blank || bad ? "is-blank" : ""}">${status}</span>
        <button class="del" type="button" data-act="del">この行を消す</button>
      </div>
    </div>`;
}

/** HTMLに出す文字を安全にする */
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** 合計カードを描く */
function renderSummary() {
  const s = makeSummary(state);
  const assets = moneyText(s.assets);
  const debt = moneyText(s.loans);
  const netKnown = s.assets.known || s.loans.known;
  const net = s.assets.sum - s.loans.sum;
  const workplace = moneyText(s.workplace);
  const pension = moneyText(s.pension, " / 月");
  document.getElementById("summary").innerHTML = `
    <div class="metric"><dt>今あるお金</dt><dd class="${assets.blank ? "is-blank" : ""}">${assets.text}</dd></div>
    <div class="metric"><dt>借金</dt><dd class="${debt.blank ? "is-blank" : ""}">${debt.text}</dd></div>
    <div class="metric wide"><dt>差し引き</dt><dd class="${!netKnown ? "is-blank" : ""} ${netKnown && net < 0 ? "is-minus" : ""}">${netKnown ? formatYen(net) : "まだわからない"}</dd></div>
    <div class="metric"><dt>年金（月額）</dt><dd class="${pension.blank ? "is-blank" : ""}">${pension.text}</dd></div>
    <div class="metric"><dt>仕事場の売値</dt><dd class="${workplace.blank ? "is-blank" : ""}">${workplace.text}</dd></div>
    ${s.blank ? '<p class="note">空欄はゼロにしていません。分かったところから足してください。</p>' : ""}`;
}

/** 今あるお金の項目カードを描く */
function renderCategories() {
  document.getElementById("categories").innerHTML = CATEGORIES.map((cat) => {
    const items = state[cat.id];
    const body = items.length
      ? items.map((item) => rowHtml(cat, item)).join("")
      : '<p class="empty">まだ入っていません。下のボタンから足せます。</p>';
    return `
      <section class="card cat ${openCat === cat.id ? "is-open" : ""}">
        <button class="cat-head" type="button" data-act="open-cat" data-cat="${cat.id}">
          ${cat.title}
          <em>${catStatus(items)}</em>
        </button>
        <div class="cat-body">
          <p class="hint">${cat.hint}</p>
          ${body}
          <button class="add" type="button" data-act="add" data-cat="${cat.id}">${cat.addLabel}</button>
        </div>
      </section>`;
  }).join("");
}

/** 兄弟の名前と人数を描く */
function renderPeople() {
  renderNameList("people", "people-list", "add-person", "人目", "例：長男");
}

/** 介護者の名前と人数を描く */
function renderCaregivers() {
  renderNameList("caregivers", "caregiver-list", "add-caregiver", "人目", "例：自分の父");
}

/** 名前の一覧を描く */
function renderNameList(kind, listId, addId, countLabel, placeholder) {
  const list = state[kind] || [];
  const box = document.getElementById(listId);
  const add = document.getElementById(addId);
  if (!box) return;
  const canRemove = list.length > 1;
  const canAdd = list.length < MAX_PEOPLE;
  const nameAttr = kind === "people" ? "data-person-name" : "data-caregiver-name";
  const delAct = kind === "people" ? "del-person" : "del-caregiver";
  box.innerHTML = list.map((person, i) => `
    <div class="people-row">
      <label class="people-label">${i + 1}${countLabel}</label>
      <input ${nameAttr}="${person.id}" value="${escapeHtml(person.title)}" placeholder="${placeholder}">
      ${canRemove ? `<button class="del" type="button" data-act="${delAct}" data-id="${person.id}">消す</button>` : ""}
    </div>`).join("");
  if (add) add.hidden = !canAdd;
}

/** 分け方のボタンを描く */
function renderSplitChoices() {
  const mode = state.costs.splitMode || "equal";
  document.getElementById("split-choices").innerHTML = SPLIT_MODES.map((item) => `
    <button type="button" class="pick ${mode === item.id ? "is-on" : ""}" data-act="split" data-split="${item.id}">${item.title}</button>
  `).join("");
}

/** 援助の項目一覧（固定4つ＋自分で足したもの） */
function helpItemList() {
  const extras = state.extras || { costs: [], help: [] };
  return [
    ...HELP_ITEMS,
    ...(extras.costs || []).map((item) => ({
      id: item.id,
      title: item.label || "その他",
      hint: "親にかかるお金のその他です。"
    })),
    ...(extras.help || []).map((item) => ({
      id: item.id,
      title: item.title || "その他",
      hint: "自分で足した項目です。かかる額も入れられます。",
      extraHelp: true
    }))
  ];
}

/** 介護・葬式・借金・片づけの援助を描く */
function renderHelp() {
  document.getElementById("help-list").innerHTML = helpItemList().map((item) => {
    const row = state.help[item.id] || emptyHelpRow(state.people);
    const extra = item.extraHelp
      ? `<label>名前</label>
        <input data-extra-help-title="${item.id}" value="${escapeHtml(item.title || "")}" placeholder="例：お墓">
        <label>かかる額</label>
        <input data-extra-help-amount="${item.id}" inputmode="numeric" placeholder="例：300000">`
      : "";
    const people = state.people.map((person, i) => {
      const on = row[person.id] !== "no";
      const cash = on
        ? `<label>用意できる額</label>
          <input data-help-cash="${item.id}" data-who="${person.id}" inputmode="numeric" placeholder="例：500000">`
        : "";
      return `<div class="help-person">
        <div class="help-row"><span data-who-label="${person.id}">${escapeHtml(person.title || "名前なし")}</span>
        <div class="choice">
          <button type="button" class="pick ${on ? "is-on" : ""}" data-act="help" data-item="${item.id}" data-who="${person.id}" data-help="yes">援助する</button>
          <button type="button" class="pick ${on ? "" : "is-on"}" data-act="help" data-item="${item.id}" data-who="${person.id}" data-help="no">しない</button>
        </div></div>
        ${cash}
        <p class="help-remain" data-remain-item="${item.id}" data-remain-who="${person.id}"></p>
      </div>`;
    }).join("");
    const del = item.extraHelp
      ? `<button class="del" type="button" data-act="del-extra-help" data-id="${item.id}">この項目を消す</button>`
      : "";
    const total = `<p class="help-total" data-help-total="${item.id}"><span>兄弟が出す</span><strong>まだわからない</strong></p>`;
    return `<section class="card"><h2>${escapeHtml(item.title)}</h2><p class="hint">${item.hint}</p>${extra}${total}${people}${del}</section>`;
  }).join("");
}

/** 援助の用意できる額を入力欄に戻す */
function fillHelpCash() {
  document.querySelectorAll("[data-help-cash]").forEach((input) => {
    const row = state.help[input.dataset.helpCash] || {};
    input.value = row[`${input.dataset.who}Cash`] ?? "";
    input.classList.toggle("is-bad", Number.isNaN(parseYen(input.value)));
  });
  fillHelpRemain();
}

/** 兄弟が出す額と、あといくら払うかを書く */
function fillHelpRemain() {
  const need = makeNeed(state);
  const byId = {};
  (need.items || []).forEach((item) => {
    byId[item.id] = item;
  });
  document.querySelectorAll("[data-help-total]").forEach((el) => {
    const item = byId[el.dataset.helpTotal];
    const remain = item ? item.remain : null;
    const strong = el.querySelector("strong");
    if (!need.ready || remain == null) {
      el.className = "help-total is-blank";
      if (strong) strong.textContent = "まだわからない";
      return;
    }
    el.className = remain ? "help-total is-short" : "help-total is-ok";
    if (strong) strong.textContent = formatYen(remain);
  });
  document.querySelectorAll("[data-remain-item]").forEach((el) => {
    const item = byId[el.dataset.remainItem];
    const index = state.people.findIndex((person) => person.id === el.dataset.remainWho);
    const person = state.people[index];
    const row = state.help[el.dataset.remainItem] || {};
    const on = person ? row[person.id] !== "no" : false;
    const share = item && index >= 0 ? item.shares[index] : null;
    const cash = item && index >= 0 ? item.readyCash[index] : null;
    const left = share != null && cash != null ? Math.max(0, share - cash) : null;
    el.textContent = remainLine(share, cash, on, need.ready);
    el.classList.toggle("is-minus", Boolean(on && left));
  });
}

/** 出す額と残りの一文 */
function remainLine(share, cash, on, ready) {
  if (!on) return "この項目は出しません。";
  if (!ready || share == null) return "数字が入ると、出す額と残りが出ます。";
  if (!share) return "親のお金で足ります。出す額は 0円です。";
  if (cash == null) return `出す額 ${formatYen(share)}。用意を入れると、残りが出ます。`;
  const left = Math.max(0, share - cash);
  if (!left) return `出す額 ${formatYen(share)}。用意した額で足ります。`;
  return `出す額 ${formatYen(share)}。あと ${formatYen(left)} です。`;
}

function fillCosts() {
  document.querySelectorAll("[data-cost]").forEach((input) => {
    input.value = state.costs[input.dataset.cost] ?? "";
    input.classList.toggle("is-bad", Number.isNaN(parseYen(input.value)));
  });
  document.querySelectorAll("[data-person-cost]").forEach((input) => {
    const map = state.costs[input.dataset.personCost];
    input.value = map && typeof map === "object" ? (map[input.dataset.who] ?? "") : "";
    input.classList.toggle("is-bad", Number.isNaN(parseYen(input.value)));
  });
  document.querySelectorAll("[data-extra-cost-label]").forEach((input) => {
    const item = (state.extras.costs || []).find((row) => row.id === input.dataset.extraCostLabel);
    if (item) input.value = item.label ?? "";
  });
  document.querySelectorAll("[data-extra-cost-amount]").forEach((input) => {
    const item = (state.extras.costs || []).find((row) => row.id === input.dataset.extraCostAmount);
    if (item) {
      input.value = item.amount ?? "";
      input.classList.toggle("is-bad", Number.isNaN(parseYen(input.value)));
    }
  });
  document.querySelectorAll("[data-extra-help-title]").forEach((input) => {
    const item = (state.extras.help || []).find((row) => row.id === input.dataset.extraHelpTitle);
    if (item) input.value = item.title ?? "";
  });
  document.querySelectorAll("[data-extra-help-amount]").forEach((input) => {
    const item = (state.extras.help || []).find((row) => row.id === input.dataset.extraHelpAmount);
    if (item) {
      input.value = item.amount ?? "";
      input.classList.toggle("is-bad", Number.isNaN(parseYen(input.value)));
    }
  });
  const years = document.getElementById("years-select");
  if (years) years.value = String(state.costs.years || 10);
}

/** 介護者ごとの金額欄を描く */
function renderPersonFields() {
  [
    ["care", "例：80000"],
    ["medical", "例：20000"],
    ["funeral", "例：2000000"]
  ].forEach(([field, placeholder]) => {
    const box = document.getElementById(`${field}-fields`);
    if (!box) return;
    box.classList.toggle("is-one", state.caregivers.length === 1);
    box.innerHTML = state.caregivers.map((person) => `
      <div>
        <label>${escapeHtml(person.title || "名前なし")}</label>
        <input data-person-cost="${field}" data-who="${person.id}" inputmode="numeric" placeholder="${placeholder}">
      </div>`).join("");
  });
}

/** かかるお金のその他を描く */
function renderExtraCosts() {
  const box = document.getElementById("extra-costs");
  if (!box) return;
  const items = state.extras.costs || [];
  box.innerHTML = items.length
    ? items.map((item) => `
      <div class="extra-row">
        <label>名前</label>
        <input data-extra-cost-label="${item.id}" value="${escapeHtml(item.label)}" placeholder="例：仏壇">
        <label>金額（円）</label>
        <input data-extra-cost-amount="${item.id}" inputmode="numeric" value="${escapeHtml(item.amount)}" placeholder="例：300000">
        <button class="del" type="button" data-act="del-extra-cost" data-id="${item.id}">この行を消す</button>
      </div>`).join("")
    : '<p class="empty">まだありません。</p>';
}

/** 年ごとの表を描く */
function renderYearTable() {
  const rows = yearRows(state.costs);
  const first = rows[0];
  const known = first && first.total != null;
  const box = document.getElementById("year-table");
  if (!known) {
    box.innerHTML = '<p class="empty">生活費・介護・病院のどれかを入れると、年ごとの表が出ます。葬式は「見通し」に1回分で足します。</p>';
    return;
  }
  const m = monthlyCosts(state.costs);
  box.innerHTML = `
    <p class="break">1年あたり　生活 ${yenOrBlank(toYearSafe(m.living))} ／ 介護 ${yenOrBlank(toYearSafe(m.care))} ／ 病院 ${yenOrBlank(toYearSafe(m.medical))}</p>
    ${rows.map((row) => `<div class="year-row"><span>${row.year}年目</span><strong>${formatYen(row.total)}</strong></div>`).join("")}
    <p class="note">${rows.length}年分の合計　${formatYen(first.total * rows.length)}</p>
    <p class="note">今は毎年同じ金額です。年によって変えたい場合は、あとから足せます。</p>`;
}

/** 月額が使えるときだけ年額にする */
function toYearSafe(monthly) {
  if (monthly == null || Number.isNaN(monthly)) return null;
  return monthly * 12;
}

/** 足りるかの結果を描く */
function renderGap() {
  const need = makeNeed(state);
  const msg = needMessage(need);
  const names = need.people.map((person) => person.title);
  document.getElementById("gap").innerHTML = `
    <div class="verdict ${msg.kind}">
      <p class="verdict-title">${msg.title}</p>
      <p>${msg.body}</p>
    </div>
    <p class="choice-label">仕事場を売った前提</p>
    <div class="choice">
      <button type="button" class="pick ${need.pool.useWorkplace ? "is-on" : ""}" data-act="sale" data-key="useWorkplace" data-val="yes">入れる</button>
      <button type="button" class="pick ${need.pool.useWorkplace ? "" : "is-on"}" data-act="sale" data-key="useWorkplace" data-val="no">入れない</button>
    </div>
    <p class="choice-label">家を売った前提</p>
    <div class="choice">
      <button type="button" class="pick ${need.pool.useHouse ? "is-on" : ""}" data-act="sale" data-key="useHouse" data-val="yes">入れる</button>
      <button type="button" class="pick ${need.pool.useHouse ? "" : "is-on"}" data-act="sale" data-key="useHouse" data-val="no">入れない</button>
    </div>
    <div class="metric"><dt>親の手元資金</dt><dd class="${need.cash.known ? "" : "is-blank"}">${need.cash.known ? formatYen(need.cash.sum) : "まだわからない"}</dd></div>
    <div class="metric"><dt>仕事場の売値</dt><dd class="${need.workplace.known ? "" : "is-blank"}">${need.workplace.known ? formatYen(need.workplace.sum) : "まだわからない"}</dd></div>
    <div class="metric wide"><dt>計算に使う親のお金</dt><dd>${formatYen(need.pool.total)}</dd></div>
    <div class="metric wide"><dt>兄弟が出す残り</dt><dd class="${need.parentShort == null ? "is-blank" : ""} ${need.parentShort ? "is-minus" : ""}">${need.parentShort == null ? "まだわからない" : formatYen(need.parentShort)}</dd></div>
    <div class="split">
      ${(need.items || []).map((item) => `
      <article>
        <h3>${item.title}</h3>
        <p>かかる額 ${item.amount == null ? "まだわからない" : formatYen(item.amount)}</p>
        <p>親のお金で出す ${formatYen(item.covered)}</p>
        <p>兄弟が出す <strong>${formatYen(item.remain)}</strong></p>
        <p class="note">${helpNote(item, names)}</p>
      </article>`).join("")}
      ${need.people.map((person) => `
      <article>
        <h3>${person.title}の合計</h3>
        <p>用意が必要な額 <strong>${yenOrBlank(person.need)}</strong></p>
        <p class="note">${cashText(person.title, person.cash, person.need)}</p>
      </article>`).join("")}
    </div>`;
}

/** その項目を誰が援助するかの文 */
function helpNote(item, names) {
  if (!item.remain) return "親のお金で足ります。";
  const helpers = names.filter((_, i) => item.pays[i]);
  if (!helpers.length) return "援助する人がいないので、残りは分けられません。";
  return names.map((name, i) => {
    if (!item.pays[i]) return `${name} 援助しない`;
    const share = formatYen(item.shares[i] || 0);
    const cash = item.readyCash ? item.readyCash[i] : null;
    if (cash == null) return `${name} 出す ${share}（用意は未記入）`;
    const left = Math.max(0, (item.shares[i] || 0) - cash);
    if (!left) return `${name} 出す ${share}（用意で足りる）`;
    return `${name} 出す ${share}（あと ${formatYen(left)}）`;
  }).join(" ／ ");
}

/** 一番上の結論文を作る */
function needMessage(need) {
  if (!need.ready) {
    return {
      kind: "",
      title: "まだ計算できません",
      body: "親の手元資金と、介護・葬式・借金・片づけを入れると、足りるかが分かります。"
    };
  }
  if (!need.parentShort) {
    return {
      kind: "is-ok",
      title: "親のお金で足りる",
      body: "この見積もりでは、介護・葬式・借金・片づけは親のお金でまかなえます。"
    };
  }
  return {
    kind: "is-ng",
    title: "親のお金では足りない",
    body: shortBody(need)
  };
}

/** 不足のとき、分け方を一文にする */
function shortBody(need) {
  const mode = SPLIT_MODES.find((item) => item.id === need.splitMode);
  const sold = [];
  if (need.pool.useWorkplace) sold.push("仕事場");
  if (need.pool.useHouse) sold.push("家");
  const sale = sold.length ? `${sold.join("と")}を売る前提です。` : "家も仕事場も売らない前提です。";
  return `兄弟が出す残りは ${formatYen(need.parentShort)} です。分け方は「${mode ? mode.title : ""}」。${sale}`;
}

/** 用意できる額で足りるかの一文 */
function cashText(title, cash, required) {
  if (required == null) return "数字が入ると、ここに出ます。";
  if (cash == null) return `${title}の「用意できる額」を入れると、足りるか出ます。`;
  if (cash >= required) return `${title}の ${formatYen(cash)} で足ります。`;
  return `${title}では ${formatYen(required - cash)} 足りません。`;
}

/** 画面全体を描き直す */
function render() {
  renderSummary();
  renderCategories();
  renderSplitChoices();
  renderPeople();
  renderCaregivers();
  renderPersonFields();
  renderExtraCosts();
  renderHelp();
  fillHelpCash();
  fillCosts();
  renderYearTable();
  renderGap();
}

/** 新しい空の行を足す */
function addItem(catId) {
  openCat = catId;
  state[catId].push({ id: `${Date.now()}-${Math.random()}`, label: "", amount: "" });
  saveData(state);
  render();
}

/** 行を消す */
function removeItem(catId, id) {
  state[catId] = state[catId].filter((item) => item.id !== id);
  saveData(state);
  render();
}

/** 今あるお金の入力を保存する */
function updateField(catId, id, field, value) {
  const item = state[catId].find((row) => row.id === id);
  if (!item) return;
  item[field] = value;
  saveData(state);
  renderSummary();
  renderGap();
  const row = document.querySelector(`[data-cat="${catId}"][data-id="${id}"]`);
  if (!row) return;
  const n = parseYen(item.amount);
  const amountInput = row.querySelector('[data-field="amount"]');
  const status = row.querySelector(".status");
  amountInput.classList.toggle("is-bad", Number.isNaN(n));
  status.textContent = Number.isNaN(n) ? "数字を入れてください" : n == null ? "まだわからない" : "記入済み";
  status.classList.toggle("is-blank", n == null || Number.isNaN(n));
  const head = document.querySelector(`[data-act=open-cat][data-cat="${catId}"] em`);
  if (head) head.textContent = catStatus(state[catId]);
}

/** 援助の用意できる額を保存する */
function updateHelpCash(item, who, value) {
  if (!state.help[item]) state.help[item] = emptyHelpRow(state.people);
  state.help[item][`${who}Cash`] = value;
  saveData(state);
  const input = document.querySelector(`[data-help-cash="${item}"][data-who="${who}"]`);
  if (input) input.classList.toggle("is-bad", Number.isNaN(parseYen(value)));
  fillHelpRemain();
  renderGap();
}

/** 兄弟の名前を保存する */
function updatePersonName(id, value) {
  const person = state.people.find((item) => item.id === id);
  if (!person) return;
  person.title = value;
  saveData(state);
  document.querySelectorAll(`[data-who-label="${id}"]`).forEach((el) => {
    el.textContent = value.trim() ? value : "名前なし";
  });
  renderGap();
}

/** 兄弟を1人足す */
function addPerson() {
  if (state.people.length >= MAX_PEOPLE) return;
  const person = { id: `p-${Date.now()}`, title: `兄弟${state.people.length + 1}` };
  state.people.push(person);
  helpItemList().forEach((item) => {
    if (!state.help[item.id]) state.help[item.id] = emptyHelpRow(state.people);
    state.help[item.id][person.id] = "yes";
    state.help[item.id][`${person.id}Cash`] = "";
  });
  saveData(state);
  renderPeople();
  renderHelp();
  fillHelpCash();
  renderGap();
}

/** 兄弟を1人消す */
function removePerson(id) {
  if (state.people.length <= 1) return;
  state.people = state.people.filter((person) => person.id !== id);
  helpItemList().forEach((item) => {
    if (!state.help[item.id]) return;
    delete state.help[item.id][id];
    delete state.help[item.id][`${id}Cash`];
  });
  saveData(state);
  renderPeople();
  renderHelp();
  fillHelpCash();
  renderGap();
}

/** 介護者の名前を保存する */
function updateCaregiverName(id, value) {
  const person = state.caregivers.find((item) => item.id === id);
  if (!person) return;
  person.title = value;
  saveData(state);
  renderPersonFields();
  fillCosts();
  renderGap();
}

/** 介護者を1人足す */
function addCaregiver() {
  if (state.caregivers.length >= MAX_PEOPLE) return;
  const person = { id: `c-${Date.now()}`, title: `介護者${state.caregivers.length + 1}` };
  state.caregivers.push(person);
  ["care", "medical", "funeral"].forEach((field) => {
    if (!state.costs[field] || typeof state.costs[field] !== "object") {
      state.costs[field] = emptyCostMap(state.caregivers);
    }
    state.costs[field][person.id] = "";
  });
  saveData(state);
  renderCaregivers();
  renderPersonFields();
  fillCosts();
  renderYearTable();
  renderGap();
}

/** 介護者を1人消す */
function removeCaregiver(id) {
  if (state.caregivers.length <= 1) return;
  state.caregivers = state.caregivers.filter((person) => person.id !== id);
  ["care", "medical", "funeral"].forEach((field) => {
    if (state.costs[field] && typeof state.costs[field] === "object") {
      delete state.costs[field][id];
    }
  });
  saveData(state);
  renderCaregivers();
  renderPersonFields();
  fillCosts();
  renderYearTable();
  renderGap();
}

/** かかるお金のその他を足す */
function addExtraCost() {
  const item = { id: `x-${Date.now()}`, label: "", amount: "" };
  if (!state.extras.costs) state.extras.costs = [];
  state.extras.costs.push(item);
  state.help[item.id] = emptyHelpRow(state.people);
  saveData(state);
  renderExtraCosts();
  fillCosts();
  renderHelp();
  fillHelpCash();
  renderGap();
}

/** かかるお金のその他を消す */
function removeExtraCost(id) {
  state.extras.costs = (state.extras.costs || []).filter((item) => item.id !== id);
  delete state.help[id];
  saveData(state);
  renderExtraCosts();
  fillCosts();
  renderHelp();
  fillHelpCash();
  renderGap();
}

/** 兄弟画面のその他項目を足す */
function addExtraHelp() {
  const item = { id: `h-${Date.now()}`, title: "その他", amount: "" };
  if (!state.extras.help) state.extras.help = [];
  state.extras.help.push(item);
  state.help[item.id] = emptyHelpRow(state.people);
  saveData(state);
  renderHelp();
  fillHelpCash();
  fillCosts();
  renderGap();
}

/** 兄弟画面のその他項目を消す */
function removeExtraHelp(id) {
  state.extras.help = (state.extras.help || []).filter((item) => item.id !== id);
  delete state.help[id];
  saveData(state);
  renderHelp();
  fillHelpCash();
  renderGap();
}

/** 介護者ごとの費用を保存する */
function updatePersonCost(field, who, value) {
  if (!state.costs[field] || typeof state.costs[field] !== "object") {
    state.costs[field] = emptyCostMap(state.caregivers);
  }
  state.costs[field][who] = value;
  saveData(state);
  const input = document.querySelector(`[data-person-cost="${field}"][data-who="${who}"]`);
  if (input) input.classList.toggle("is-bad", Number.isNaN(parseYen(value)));
  renderYearTable();
  renderGap();
}

/** 費用の入力を保存する */
function updateCost(field, value) {
  state.costs[field] = value;
  saveData(state);
  const input = document.querySelector(`[data-cost="${field}"]`);
  if (input) input.classList.toggle("is-bad", Number.isNaN(parseYen(value)));
  renderYearTable();
  renderGap();
}

document.getElementById("categories").addEventListener("click", (event) => {
  const open = event.target.closest("[data-act=open-cat]");
  if (open) {
    openCat = openCat === open.dataset.cat ? "" : open.dataset.cat;
    renderCategories();
    return;
  }
  const add = event.target.closest("[data-act=add]");
  if (add) addItem(add.dataset.cat);
  const del = event.target.closest("[data-act=del]");
  if (del) {
    const row = del.closest(".row");
    removeItem(row.dataset.cat, row.dataset.id);
  }
});

document.getElementById("categories").addEventListener("input", (event) => {
  const input = event.target.closest("input");
  if (!input) return;
  const row = input.closest(".row");
  updateField(row.dataset.cat, row.dataset.id, input.dataset.field, input.value);
});

document.querySelector(".app").addEventListener("input", (event) => {
  const cost = event.target.closest("[data-cost]");
  if (cost) updateCost(cost.dataset.cost, cost.value);
  const personCost = event.target.closest("[data-person-cost]");
  if (personCost) updatePersonCost(personCost.dataset.personCost, personCost.dataset.who, personCost.value);
  const helpCash = event.target.closest("[data-help-cash]");
  if (helpCash) updateHelpCash(helpCash.dataset.helpCash, helpCash.dataset.who, helpCash.value);
  const name = event.target.closest("[data-person-name]");
  if (name) updatePersonName(name.dataset.personName, name.value);
  const caregiver = event.target.closest("[data-caregiver-name]");
  if (caregiver) updateCaregiverName(caregiver.dataset.caregiverName, caregiver.value);
  const extraLabel = event.target.closest("[data-extra-cost-label]");
  if (extraLabel) {
    const item = (state.extras.costs || []).find((row) => row.id === extraLabel.dataset.extraCostLabel);
    if (item) {
      item.label = extraLabel.value;
      saveData(state);
      renderGap();
    }
  }
  const extraAmount = event.target.closest("[data-extra-cost-amount]");
  if (extraAmount) {
    const item = (state.extras.costs || []).find((row) => row.id === extraAmount.dataset.extraCostAmount);
    if (item) {
      item.amount = extraAmount.value;
      saveData(state);
      extraAmount.classList.toggle("is-bad", Number.isNaN(parseYen(extraAmount.value)));
      renderGap();
    }
  }
  const extraHelpTitle = event.target.closest("[data-extra-help-title]");
  if (extraHelpTitle) {
    const item = (state.extras.help || []).find((row) => row.id === extraHelpTitle.dataset.extraHelpTitle);
    if (item) {
      item.title = extraHelpTitle.value;
      saveData(state);
      renderGap();
    }
  }
  const extraHelpAmount = event.target.closest("[data-extra-help-amount]");
  if (extraHelpAmount) {
    const item = (state.extras.help || []).find((row) => row.id === extraHelpAmount.dataset.extraHelpAmount);
    if (item) {
      item.amount = extraHelpAmount.value;
      saveData(state);
      extraHelpAmount.classList.toggle("is-bad", Number.isNaN(parseYen(extraHelpAmount.value)));
      renderGap();
    }
  }
});

document.getElementById("years-select").addEventListener("change", (event) => {
  state.costs.years = Number(event.target.value);
  saveData(state);
  renderYearTable();
  renderGap();
});

document.getElementById("split-card").addEventListener("click", (event) => {
  const split = event.target.closest("[data-act=split]");
  if (!split) return;
  state.costs.splitMode = split.dataset.split;
  saveData(state);
  renderSplitChoices();
  renderGap();
});

document.querySelector(".app").addEventListener("click", (event) => {
  const go = event.target.closest("[data-go]");
  if (go) showScreen(go.dataset.go);
  if (event.target.closest("[data-act=add-person]")) {
    addPerson();
    return;
  }
  const delPerson = event.target.closest("[data-act=del-person]");
  if (delPerson) {
    removePerson(delPerson.dataset.id);
    return;
  }
  if (event.target.closest("[data-act=add-caregiver]")) {
    addCaregiver();
    return;
  }
  const delCaregiver = event.target.closest("[data-act=del-caregiver]");
  if (delCaregiver) {
    removeCaregiver(delCaregiver.dataset.id);
    return;
  }
  if (event.target.closest("[data-act=add-extra-cost]")) {
    addExtraCost();
    return;
  }
  const delExtraCost = event.target.closest("[data-act=del-extra-cost]");
  if (delExtraCost) {
    removeExtraCost(delExtraCost.dataset.id);
    return;
  }
  if (event.target.closest("[data-act=add-extra-help]")) {
    addExtraHelp();
    return;
  }
  const delExtraHelp = event.target.closest("[data-act=del-extra-help]");
  if (delExtraHelp) {
    removeExtraHelp(delExtraHelp.dataset.id);
    return;
  }
  const help = event.target.closest("[data-act=help]");
  if (help) {
    const item = help.dataset.item;
    if (!state.help[item]) state.help[item] = emptyHelpRow(state.people);
    state.help[item][help.dataset.who] = help.dataset.help;
    saveData(state);
    renderHelp();
    fillHelpCash();
    renderGap();
    return;
  }
  const sale = event.target.closest("[data-act=sale]");
  if (sale) {
    state.costs[sale.dataset.key] = sale.dataset.val;
    saveData(state);
    renderGap();
  }
});

render();
