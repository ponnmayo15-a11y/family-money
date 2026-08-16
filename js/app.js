import { CATEGORIES, emptyData } from "./data.js";
import { parseYen, formatYen, makeSummary, yearRows, makeNeed, monthlyCosts } from "./calc.js";

const STORAGE_KEY = "family-money-v1";

/** 保存データを読み出す */
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    return {
      ...emptyData(),
      ...parsed,
      costs: { ...emptyData().costs, ...(parsed.costs || {}) }
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

let state = loadData();
let openCat = "";

/** 押したページだけ開く */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.toggle("is-on", el.id === id));
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
  const pension = moneyText(s.pension, " / 月");
  document.getElementById("summary").innerHTML = `
    <div class="metric"><dt>今あるお金</dt><dd class="${assets.blank ? "is-blank" : ""}">${assets.text}</dd></div>
    <div class="metric"><dt>借金</dt><dd class="${debt.blank ? "is-blank" : ""}">${debt.text}</dd></div>
    <div class="metric wide"><dt>差し引き</dt><dd class="${!netKnown ? "is-blank" : ""} ${netKnown && net < 0 ? "is-minus" : ""}">${netKnown ? formatYen(net) : "まだわからない"}</dd></div>
    <div class="metric wide"><dt>年金（月額）</dt><dd class="${pension.blank ? "is-blank" : ""}">${pension.text}</dd></div>
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

/** 費用の入力欄に保存値を入れる */
function fillCosts() {
  document.querySelectorAll("[data-cost]").forEach((input) => {
    input.value = state.costs[input.dataset.cost] ?? "";
    input.classList.toggle("is-bad", Number.isNaN(parseYen(input.value)));
  });
  document.getElementById("years-select").value = String(state.costs.years || 10);
}

/** 年ごとの表を描く */
function renderYearTable() {
  const rows = yearRows(state.costs);
  const first = rows[0];
  const known = first && first.total != null;
  const box = document.getElementById("year-table");
  if (!known) {
    box.innerHTML = '<p class="empty">生活費・介護・病院のどれかを入れると、年ごとの表が出ます。葬式は「足りるか」に1回分で足します。</p>';
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
  document.getElementById("gap").innerHTML = `
    <div class="verdict ${msg.kind}">
      <p class="verdict-title">${msg.title}</p>
      <p>${msg.body}</p>
    </div>
    <div class="metric wide"><dt>親のお金で足りない額</dt><dd class="${need.parentShort == null ? "is-blank" : ""} ${need.parentShort ? "is-minus" : ""}">${need.parentShort == null ? "まだわからない" : formatYen(need.parentShort)}</dd></div>
    <div class="split">
      <article>
        <h3>長男が全部出す</h3>
        <p>親の不足 ${yenOrBlank(need.sonAll)}</p>
        <p>受験と合わせると <strong>${yenOrBlank(need.sonAllWithExam)}</strong></p>
        <p class="note">${ownText(need, need.sonAllWithExam)}</p>
      </article>
      <article>
        <h3>3人で分ける</h3>
        <p>長男・姉ひとり ${yenOrBlank(need.each)}</p>
        <p>長男＋受験は <strong>${yenOrBlank(need.sonSplitWithExam)}</strong></p>
        <p class="note">${ownText(need, need.sonSplitWithExam)}</p>
      </article>
    </div>
    <div class="metric"><dt>1年の年金</dt><dd class="${need.yearlyIn == null ? "is-blank" : ""}">${yenOrBlank(need.yearlyIn)}</dd></div>
    <div class="metric"><dt>1年の介護・暮らし</dt><dd class="${need.yearlyOut == null ? "is-blank" : ""}">${yenOrBlank(need.yearlyOut)}</dd></div>
    ${need.funeral != null ? `<p class="note">葬式 ${formatYen(need.funeral)} を1回分、足りない額に足しています。</p>` : '<p class="note">葬式はまだ入っていません。</p>'}
    ${need.costBlank ? '<p class="note">親の費用に空欄があります。空欄は足していません。</p>' : ""}`;
}

/** 一番上の結論文を作る */
function needMessage(need) {
  if (!need.ready) {
    return {
      kind: "",
      title: "まだ計算できません",
      body: "親の年金・貯金と、介護などの費用を入れると、長男がいくら出すかが分かります。"
    };
  }
  if (!need.parentShort) {
    return {
      kind: "is-ok",
      title: "親のお金で足りる",
      body: `この見積もりでは、介護と葬式は親のお金でまかなえます。長男の家は、子供の受験 ${need.exam == null ? "（未記入）" : formatYen(need.exam)} を用意すればよい、という計算です。`
    };
  }
  return {
    kind: "is-ng",
    title: "親のお金では足りない",
    body: `親の不足は ${formatYen(need.parentShort)} です。長男が全部出すか、姉2人と3人で分けるかで、自分の家の負担が変わります。`
  };
}

/** 自分の家で足りるかの一文 */
function ownText(need, required) {
  if (required == null) return "数字が入ると、ここに出ます。";
  if (need.ownCash == null) return "「用意できる額」を入れると、自分の家で足りるか出ます。";
  if (need.ownCash >= required) return `自分の家の ${formatYen(need.ownCash)} で足ります。`;
  return `自分の家では ${formatYen(required - need.ownCash)} 足りません。`;
}

/** 画面全体を描き直す */
function render() {
  renderSummary();
  renderCategories();
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
  const input = event.target.closest("[data-cost]");
  if (input) updateCost(input.dataset.cost, input.value);
});

document.getElementById("years-select").addEventListener("change", (event) => {
  state.costs.years = Number(event.target.value);
  saveData(state);
  renderYearTable();
  renderGap();
});

document.querySelector(".app").addEventListener("click", (event) => {
  const go = event.target.closest("[data-go]");
  if (go) showScreen(go.dataset.go);
});

render();
