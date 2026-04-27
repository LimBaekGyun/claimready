import './style.css';
import {
  CLAIM_PROFILE_OPTIONS,
  analyzeClaimReadiness,
  buildDocumentRecord,
  createDefaultPolicyAssumptions,
  createReportText,
  resolveClaimProfile,
} from './claim-engine.js';
import { extractTextFromFile } from './document-pipeline.js';
import { extractInsurerResponseInsights } from './insurer-response-parser.js';
import { extractPolicyInsights, formatMoney } from './policy-parser.js';
import { demoCases } from './sample-cases.js';

const defaultPolicyAssumptions = createDefaultPolicyAssumptions();
const currencyFormatter = new Intl.NumberFormat('ko-KR');
const app = document.querySelector('#app');

const state = {
  documents: [],
  policyDocuments: [],
  responseDocuments: [],
  responseManualText: '',
  responseManualInsurer: 'unknown',
  selectedProfileId: 'samsung-fire',
  analysis: null,
  policySummary: null,
  responseSummary: null,
  policyAutoAssumptions: {},
  policyManualOverrides: {},
  policyAssumptions: { ...defaultPolicyAssumptions },
  processing: false,
  progressTitle: '',
  progressDetail: '',
  error: '',
  runLabel: '?꾩쭅 遺꾩꽍???ㅽ뻾?섏? ?딆븯?듬땲??',
};

app.innerHTML = `
  <div class="backdrop"></div>
  <main class="shell">
    <section class="hero panel">
      <div class="hero-copy">
        <span class="eyebrow">ClaimReady Beta</span>
        <h1>蹂댄뿕 泥?뎄 以鍮꾨룄? ?덉긽 ?섎졊?≪쓣 媛숈씠 蹂대뒗 ?꾧뎄</h1>
        <p class="hero-text">
          蹂묒썝 ?쒕쪟瑜??щ━硫?以鍮꾨룄? ?꾨씫 ?쒕쪟瑜??뺣━?섍퀬, 蹂댄뿕利앷텒?대굹 ?쎄????④퍡 ?щ━硫?          異붿젙媛믪쓣 湲곕낯 媛?뺤씠 ?꾨땲??<strong>?낅줈?쒗븳 ?쎄? ?댁슜</strong>?쇰줈 ?ㅼ떆 怨꾩궛?⑸땲??
        </p>
      </div>
      <div class="hero-stat">
        <div class="stat">
          <span class="stat-label">?섎즺 ?쒕쪟</span>
          <strong>?곸닔利?/ ?몃??댁뿭??/ 吏꾨떒??/strong>
        </div>
        <div class="stat">
          <span class="stat-label">?쎄? ?낅젰</span>
          <strong>蹂댄뿕利앷텒 / ?쎄? PDF / ?대?吏</strong>
        </div>
        <div class="stat">
          <span class="stat-label">異쒕젰</span>
          <strong>以鍮꾨룄 + 吏湲?異붿젙 + ???媛?대뱶</strong>
        </div>
        <div class="stat">
          <span class="stat-label">湲곗?</span>
          <strong>?쇱꽦?붿옱 ?덈궡 + ?낅줈???쎄? 異붿텧</strong>
        </div>
      </div>
    </section>

    <section class="workspace">
      <div class="left-column">
        <section class="panel control-panel">
          <div class="section-head">
            <div>
              <span class="section-kicker">1. ?섎즺 ?쒕쪟</span>
              <h2>泥?뎄 ?쒕쪟 ?щ━湲?/h2>
            </div>
            <span class="support-chip">以鍮꾨룄 遺꾩꽍??/span>
          </div>

          <label class="dropzone" id="dropzone" for="file-input">
            <input id="file-input" type="file" multiple accept="image/*,.pdf,.txt" />
            <div class="dropzone-copy">
              <strong>?곸닔利? ?몃??댁뿭?? 泥섎갑?? 吏꾨떒???깆쓣 ?щ━?몄슂</strong>
              <p>?대?吏, PDF, TXT瑜?吏?먰빀?덈떎. OCR?대굹 PDF ?띿뒪??異붿텧 ???쒕쪟 ?좏삎怨??꾨씫 ??ぉ???뺣━?⑸땲??</p>
            </div>
          </label>

          <div class="cta-row">
            <button class="button button-strong" type="button" data-demo-case="outpatient-gap">?섑뵆 耳?댁뒪 A</button>
            <button class="button" type="button" data-demo-case="inpatient-ready">?섑뵆 耳?댁뒪 B</button>
            <button class="button button-muted" type="button" id="clear-button">?꾩껜 珥덇린??/button>
          </div>

          <div class="helper-grid">
            <article>
              <strong>?섑뵆 A</strong>
              <p>?듭썝 移섎즺 ???곸닔利? ?몃??댁뿭?? 泥섎갑?꾩씠 ?덇퀬 ?쎄?源뚯? 媛숈씠 ?곸슜???덉떆?낅땲??</p>
            </article>
            <article>
              <strong>?섑뵆 B</strong>
              <p>?낆썝 泥?뎄???꾩슂??二쇱슂 ?쒕쪟媛 嫄곗쓽 媛뽰떠吏??곹깭瑜?蹂댁뿬以띾땲??</p>
            </article>
          </div>
        </section>

        <section class="panel policy-panel">
          <div class="section-head">
            <div>
              <span class="section-kicker">2. 蹂댄뿕利앷텒 / ?쎄?</span>
              <h2>蹂댁옣議곌굔 ?먮룞 異붿텧</h2>
            </div>
            <span class="support-chip">?덉긽 ?섎졊??蹂댁젙??/span>
          </div>

          <label class="dropzone dropzone-compact" id="policy-dropzone" for="policy-file-input">
            <input id="policy-file-input" type="file" multiple accept="image/*,.pdf,.txt" />
            <div class="dropzone-copy">
              <strong>蹂댄뿕利앷텒, ?곹뭹?ㅻ챸?? ?쎄? PDF瑜??щ━?몄슂</strong>
              <p>蹂댁긽鍮꾩쑉, ?듭썝 怨듭젣, 泥섎갑 怨듭젣, ?곌컙 ?쒕룄, 吏꾨떒鍮? ?섏닠鍮꾨? ?먮룞 異붿텧??異붿젙?앹뿉 諛섏쁺?⑸땲??</p>
            </div>
          </label>

          <div class="cta-row">
            <button class="button" type="button" id="policy-reset-button">?쎄?媛믩쭔 珥덇린??/button>
          </div>

          <div class="policy-summary-card" id="policy-summary-card">
            <div class="policy-summary-head">
              <div>
                <span class="policy-kicker">?꾩옱 湲곗?</span>
                <h3 id="policy-source-title">湲곕낯 媛?뺢컪 ?ъ슜 以?/h3>
              </div>
              <span class="policy-source-pill" id="policy-source-pill">manual</span>
            </div>
            <p class="policy-source-note" id="policy-source-note">
              ?꾩쭅 蹂댄뿕利앷텒?대굹 ?쎄????щ━吏 ?딆븯?듬땲?? ?꾨옒 ?낅젰移몄? 湲곕낯 媛?뺢컪?낅땲??
            </p>
            <div class="policy-summary-grid" id="policy-summary-grid"></div>
            <ul class="plain-list subtle" id="policy-summary-notes"></ul>
          </div>

          <div class="section-head compact section-head-inline">
            <div>
              <span class="section-kicker">3. ?섎룞 蹂댁젙</span>
              <h2>?먮룞 異붿텧媛??섏젙</h2>
            </div>
          </div>

          <div class="policy-grid">
            <label class="field">
              <span>?ㅼ넀 蹂댁긽鍮꾩쑉</span>
              <select id="coverage-rate">
                <option value="0.9">90%</option>
                <option value="0.8">80%</option>
                <option value="0.7">70%</option>
              </select>
            </label>
            <label class="field">
              <span>?듭썝 怨듭젣</span>
              <input id="outpatient-deductible" type="number" min="0" step="1000" />
            </label>
            <label class="field">
              <span>泥섎갑 議곗젣 怨듭젣</span>
              <input id="prescription-deductible" type="number" min="0" step="1000" />
            </label>
            <label class="field">
              <span>?낆썝 怨듭젣</span>
              <input id="inpatient-deductible" type="number" min="0" step="1000" />
            </label>
            <label class="field">
              <span>?곌컙 ?쒕룄</span>
              <input id="annual-limit" type="number" min="0" step="10000" />
            </label>
            <label class="field">
              <span>吏꾨떒鍮??뱀빟</span>
              <input id="diagnosis-benefit" type="number" min="0" step="10000" />
            </label>
            <label class="field">
              <span>?섏닠鍮??뱀빟</span>
              <input id="surgery-benefit" type="number" min="0" step="10000" />
            </label>
            <label class="field">
              <span>?대? 吏湲됰컺? 湲덉븸</span>
              <input id="already-paid" type="number" min="0" step="10000" />
            </label>
          </div>
          <p class="field-help" id="policy-field-help">
            ?쎄? ?낅줈???꾩뿉??湲곕낯 媛?뺢컪???ъ슜?⑸땲?? ?쎄????щ━硫??먮룞 異붿텧媛믪쑝濡?諛붾뚭퀬, 洹????낅젰移몄뿉???ㅼ떆 ??뼱?????덉뒿?덈떎.
          </p>

          <div class="section-head compact section-head-inline">
            <div>
              <span class="section-kicker">4. ?쎄? 臾몄꽌</span>
              <h2>異붿텧???ъ슜??臾몄꽌</h2>
            </div>
          </div>
          <div id="policy-docs-list" class="docs-list empty-state">
            ?꾩쭅 ?쎄? 臾몄꽌媛 ?놁뒿?덈떎.
          </div>
        </section>

        <section class="panel response-panel">
          <div class="section-head">
            <div>
              <span class="section-kicker">3. 蹂댄뿕???뚯떊</span>
              <h2>異붽??쒕쪟 ?붿껌??/ 遺吏湲??듬낫??/h2>
            </div>
            <span class="support-chip">遺꾩웳 ??묒슜</span>
          </div>

          <label class="dropzone dropzone-compact" id="response-dropzone" for="response-file-input">
            <input id="response-file-input" type="file" multiple accept="image/*,.pdf,.txt" />
            <div class="dropzone-copy">
              <strong>蹂댄뿕??臾몄옄, 異붽??쒕쪟 ?붿껌?? 遺吏湲??덈궡臾몄쓣 ?щ━?몄슂</strong>
              <p>蹂댄뿕?ш? ?ㅼ젣濡??≪? ?곸젏???쎌뼱??臾댁뾿????以鍮꾪빐???섎뒗吏 ?곕줈 ?뺣━?⑸땲??</p>
            </div>
          </label>

          <div class="response-entry-grid">
            <label class="field">
              <span>보험사 선택</span>
              <select id="response-insurer-select">
                <option value="unknown">모름</option>
                <option value="삼성화재">삼성화재</option>
                <option value="KB손해보험">KB손해보험</option>
                <option value="DB손해보험">DB손해보험</option>
                <option value="메리츠화재">메리츠화재</option>
                <option value="현대해상">현대해상</option>
              </select>
            </label>
            <label class="field">
              <span>회신 내용 붙여넣기</span>
              <textarea id="response-paste-input" placeholder="예: 추가서류 요청: 질병분류코드가 포함된 처방전 제출 필요&#10;비급여 항목 확인을 위해 진료비 세부내역서 제출 요청"></textarea>
            </label>
            <div class="response-entry-actions">
              <button class="button" type="button" id="response-apply-button">붙여넣기 반영</button>
              <button class="button button-muted" type="button" id="response-clear-button">붙여넣기 초기화</button>
            </div>
          </div>

          <div class="policy-summary-card">
            <div class="policy-summary-head">
              <div>
                <span class="policy-kicker">?뚯떊 遺꾩꽍</span>
                <h3 id="response-source-title">?뚯떊 臾몄꽌 ?놁쓬</h3>
              </div>
              <span class="policy-source-pill" id="response-source-pill">none</span>
            </div>
            <p class="policy-source-note" id="response-summary-note">
              ?꾩쭅 蹂댄뿕???뚯떊 臾몄꽌瑜??щ━吏 ?딆븯?듬땲??
            </p>
            <div class="policy-summary-grid" id="response-summary-grid"></div>
            <ul class="plain-list subtle" id="response-summary-actions"></ul>
          </div>

          <div class="section-head compact section-head-inline">
            <div>
              <span class="section-kicker">4. ?뚯떊 臾몄꽌</span>
              <h2>異붿텧???ъ슜???뚯떊</h2>
            </div>
          </div>
          <div id="response-docs-list" class="docs-list empty-state">
            ?꾩쭅 ?뚯떊 臾몄꽌媛 ?놁뒿?덈떎.
          </div>
        </section>

        <section class="panel progress-panel" id="progress-panel" hidden>
          <div class="section-head compact">
            <div>
              <span class="section-kicker">泥섎━ 以?/span>
              <h2 id="progress-title">臾몄꽌瑜?遺꾩꽍?섎뒗 以묒엯?덈떎.</h2>
            </div>
          </div>
          <p id="progress-detail" class="muted"></p>
        </section>

        <section class="panel docs-panel">
          <div class="section-head">
            <div>
              <span class="section-kicker">5. ?섎즺 臾몄꽌 臾띠쓬</span>
              <h2>?낅줈?쒗븳 ?쒕쪟</h2>
            </div>
            <span class="muted" id="run-label">?꾩쭅 遺꾩꽍???ㅽ뻾?섏? ?딆븯?듬땲??</span>
          </div>
          <div id="docs-list" class="docs-list empty-state">
            ?꾩쭅 ?섎즺 ?쒕쪟媛 ?놁뒿?덈떎. ?섑뵆 耳?댁뒪瑜??꾨Ⅴ硫?諛붾줈 寃곌낵瑜?蹂????덉뒿?덈떎.
          </div>
        </section>
      </div>

      <div class="right-column">
        <section class="panel result-panel">
          <div class="section-head">
            <div>
              <span class="section-kicker">6. 寃곌낵</span>
              <h2>泥?뎄 readiness</h2>
            </div>
            <button class="button button-muted" type="button" id="download-button" disabled>由ы룷???ㅼ슫濡쒕뱶</button>
          </div>
          <div id="analysis-root" class="analysis-placeholder">
            以鍮꾨룄 ?먯닔, ?꾨씫 ?쒕쪟, ?덉긽 ?섎졊?? 遺吏湲????媛?대뱶瑜??ш린??蹂댁뿬以띾땲??
          </div>
        </section>
      </div>
    </section>
  </main>
`;

const fileInput = document.querySelector('#file-input');
const policyFileInput = document.querySelector('#policy-file-input');
const responseFileInput = document.querySelector('#response-file-input');
const dropzone = document.querySelector('#dropzone');
const policyDropzone = document.querySelector('#policy-dropzone');
const responseDropzone = document.querySelector('#response-dropzone');
const clearButton = document.querySelector('#clear-button');
const policyResetButton = document.querySelector('#policy-reset-button');
const docsList = document.querySelector('#docs-list');
const policyDocsList = document.querySelector('#policy-docs-list');
const responseDocsList = document.querySelector('#response-docs-list');
const runLabel = document.querySelector('#run-label');
const progressPanel = document.querySelector('#progress-panel');
const progressTitle = document.querySelector('#progress-title');
const progressDetail = document.querySelector('#progress-detail');
const analysisRoot = document.querySelector('#analysis-root');
const downloadButton = document.querySelector('#download-button');
const policySourceTitle = document.querySelector('#policy-source-title');
const policySourcePill = document.querySelector('#policy-source-pill');
const policySourceNote = document.querySelector('#policy-source-note');
const policySummaryGrid = document.querySelector('#policy-summary-grid');
const policySummaryNotes = document.querySelector('#policy-summary-notes');
const policyFieldHelp = document.querySelector('#policy-field-help');
const policySummaryCard = document.querySelector('#policy-summary-card');
const responseSourceTitle = document.querySelector('#response-source-title');
const responseSourcePill = document.querySelector('#response-source-pill');
const responseSummaryNote = document.querySelector('#response-summary-note');
const responseSummaryGrid = document.querySelector('#response-summary-grid');
const responseSummaryActions = document.querySelector('#response-summary-actions');
const responseInsurerSelect = document.querySelector('#response-insurer-select');
const responsePasteInput = document.querySelector('#response-paste-input');
const responseApplyButton = document.querySelector('#response-apply-button');
const responseClearButton = document.querySelector('#response-clear-button');
const claimInsurerControls = mountClaimInsurerControls();
const claimInsurerSelect = claimInsurerControls.querySelector('#claim-insurer-select');
const claimInsurerHelp = claimInsurerControls.querySelector('#claim-insurer-help');

const policyControls = {
  coverageRate: document.querySelector('#coverage-rate'),
  outpatientDeductible: document.querySelector('#outpatient-deductible'),
  prescriptionDeductible: document.querySelector('#prescription-deductible'),
  inpatientDeductible: document.querySelector('#inpatient-deductible'),
  annualLimit: document.querySelector('#annual-limit'),
  diagnosisBenefit: document.querySelector('#diagnosis-benefit'),
  surgeryBenefit: document.querySelector('#surgery-benefit'),
  alreadyPaid: document.querySelector('#already-paid'),
};

syncPolicyControls();
wirePolicyControls();
bindFileInput(fileInput, processMedicalFiles);
bindFileInput(policyFileInput, processPolicyFiles);
bindFileInput(responseFileInput, processResponseFiles);
bindDropzone(dropzone, processMedicalFiles);
bindDropzone(policyDropzone, processPolicyFiles);
bindDropzone(responseDropzone, processResponseFiles);

responseInsurerSelect.value = state.responseManualInsurer;
responsePasteInput.value = state.responseManualText;
claimInsurerSelect.value = state.selectedProfileId;

claimInsurerSelect.addEventListener('change', () => {
  state.selectedProfileId = claimInsurerSelect.value;
  rerunAnalysisIfNeeded();
  state.runLabel = '보험사 분석 기준을 변경했습니다.';
  render();
});

responseApplyButton.addEventListener('click', () => {
  state.responseManualInsurer = responseInsurerSelect.value;
  state.responseManualText = responsePasteInput.value;
  refreshResponseSummary();
  state.runLabel = '붙여넣은 회신 내용을 반영했습니다.';
  render();
});

responseClearButton.addEventListener('click', () => {
  state.responseManualInsurer = 'unknown';
  state.responseManualText = '';
  responseInsurerSelect.value = 'unknown';
  responsePasteInput.value = '';
  refreshResponseSummary();
  state.runLabel = '붙여넣은 회신 내용을 초기화했습니다.';
  render();
});

document.querySelectorAll('[data-demo-case]').forEach((button) => {
  button.addEventListener('click', () => loadDemoCase(button.dataset.demoCase));
});

clearButton.addEventListener('click', () => {
  resetAll();
  state.runLabel = '?꾩껜 ?낅젰媛믪쓣 珥덇린?뷀뻽?듬땲??';
  render();
});

policyResetButton.addEventListener('click', () => {
  resetPolicyInputs();
  state.runLabel = '?쎄? ?먮룞 異붿텧媛믨낵 ?섎룞 蹂댁젙媛믪쓣 珥덇린?뷀뻽?듬땲??';
  rerunAnalysisIfNeeded();
  render();
});

downloadButton.addEventListener('click', () => {
  if (!state.analysis) {
    return;
  }

  const report = buildDownloadReport();
  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `claimready-report-${new Date().toISOString().slice(0, 10)}.txt`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
});

function bindFileInput(input, handler) {
  input.addEventListener('change', async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length) {
      await handler(files);
    }
    input.value = '';
  });
}

function bindDropzone(element, handler) {
  ['dragenter', 'dragover'].forEach((eventName) => {
    element.addEventListener(eventName, (event) => {
      event.preventDefault();
      element.classList.add('is-dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    element.addEventListener(eventName, (event) => {
      event.preventDefault();
      element.classList.remove('is-dragover');
    });
  });

  element.addEventListener('drop', async (event) => {
    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length) {
      await handler(files);
    }
  });
}

function syncPolicyControls() {
  policyControls.coverageRate.value = String(state.policyAssumptions.coverageRate);
  policyControls.outpatientDeductible.value = state.policyAssumptions.outpatientDeductible;
  policyControls.prescriptionDeductible.value = state.policyAssumptions.prescriptionDeductible;
  policyControls.inpatientDeductible.value = state.policyAssumptions.inpatientDeductible;
  policyControls.annualLimit.value = state.policyAssumptions.annualLimit;
  policyControls.diagnosisBenefit.value = state.policyAssumptions.diagnosisBenefit;
  policyControls.surgeryBenefit.value = state.policyAssumptions.surgeryBenefit;
  policyControls.alreadyPaid.value = state.policyAssumptions.alreadyPaid;
}

function wirePolicyControls() {
  Object.values(policyControls).forEach((control) => {
    control.addEventListener('input', handlePolicyChange);
    control.addEventListener('change', handlePolicyChange);
  });
}

function handlePolicyChange() {
  state.policyManualOverrides = {
    coverageRate: Number(policyControls.coverageRate.value),
    outpatientDeductible: Number(policyControls.outpatientDeductible.value || 0),
    prescriptionDeductible: Number(policyControls.prescriptionDeductible.value || 0),
    inpatientDeductible: Number(policyControls.inpatientDeductible.value || 0),
    annualLimit: Number(policyControls.annualLimit.value || 0),
    diagnosisBenefit: Number(policyControls.diagnosisBenefit.value || 0),
    surgeryBenefit: Number(policyControls.surgeryBenefit.value || 0),
    alreadyPaid: Number(policyControls.alreadyPaid.value || 0),
  };

  recomputePolicyAssumptions();

  if (state.documents.length) {
    state.runLabel = '?섎룞 蹂댁젙媛믪쓣 諛섏쁺??異붿젙 寃곌낵瑜??ㅼ떆 怨꾩궛?덉뒿?덈떎.';
    rerunAnalysisIfNeeded();
  }

  render();
}

function recomputePolicyAssumptions() {
  state.policyAssumptions = {
    ...defaultPolicyAssumptions,
    ...state.policyAutoAssumptions,
    ...state.policyManualOverrides,
  };
  syncPolicyControls();
}

function loadDemoCase(caseId) {
  const demoCase = demoCases.find((entry) => entry.id === caseId);
  if (!demoCase) {
    return;
  }

  hydratePolicyDocuments(
    (demoCase.policyDocuments || []).map((document, index) =>
      buildPolicyDocument({
        id: `demo-policy-${caseId}-${index + 1}`,
        name: document.name,
        text: document.text,
        pageCount: document.pageCount ?? 1,
        sourceType: 'demo',
        previewUrl: null,
      }),
    ),
    false,
  );

  hydrateResponseDocuments(
    (demoCase.responseDocuments || []).map((document, index) =>
      buildResponseDocument({
        id: `demo-response-${caseId}-${index + 1}`,
        name: document.name,
        text: document.text,
        pageCount: document.pageCount ?? 1,
        sourceType: 'demo',
        previewUrl: null,
      }),
    ),
  );

  state.documents = demoCase.documents.map((document, index) =>
    buildDocumentRecord({
      id: `demo-${caseId}-${index + 1}`,
      name: document.name,
      sourceType: 'demo',
      pageCount: document.pageCount ?? 1,
      text: document.text,
      previewUrl: null,
    }),
  );
  state.error = '';
  state.runLabel = `${demoCase.title} ?섑뵆??遺덈윭?붿뒿?덈떎.`;
  rerunAnalysisIfNeeded();
  render();
}

async function processMedicalFiles(files) {
  state.processing = true;
  state.error = '';
  state.documents = [];
  state.analysis = null;
  state.runLabel = `${files.length}媛??섎즺 臾몄꽌瑜??낅줈?쒗뻽?듬땲??`;
  updateProgress('?섎즺 ?쒕쪟瑜?以鍮꾪븯??以묒엯?덈떎.', '泥?OCR ?몄뼱 濡쒕뵫 ??紐?珥???嫄몃┫ ???덉뒿?덈떎.');

  const documents = [];

  try {
    for (const [index, file] of files.entries()) {
      updateProgress(`${index + 1}/${files.length} ${file.name}`, '?섎즺 ?쒕쪟 ?띿뒪?몃? 異붿텧?섎뒗 以묒엯?덈떎.');

      const extracted = await extractTextFromFile(file, (message) => {
        updateProgress(`${index + 1}/${files.length} ${file.name}`, message);
      });

      documents.push(
        buildDocumentRecord({
          id: crypto.randomUUID(),
          name: file.name,
          sourceType: file.type || 'upload',
          pageCount: extracted.pageCount,
          text: extracted.text,
          previewUrl: extracted.previewUrl,
        }),
      );
    }

    state.documents = documents;
    rerunAnalysisIfNeeded();
  } catch (error) {
    console.error(error);
    state.error = error instanceof Error ? error.message : '?섎즺 臾몄꽌瑜?泥섎━?섏? 紐삵뻽?듬땲??';
  } finally {
    state.processing = false;
    render();
  }
}

async function processPolicyFiles(files) {
  state.processing = true;
  state.error = '';
  updateProgress('蹂댄뿕利앷텒怨??쎄????쎈뒗 以묒엯?덈떎.', '?띿뒪?몃? 異붿텧????蹂댁옣議곌굔 ?꾨낫瑜?李얠뒿?덈떎.');

  const policyDocuments = [];

  try {
    for (const [index, file] of files.entries()) {
      updateProgress(`${index + 1}/${files.length} ${file.name}`, '?쎄? 臾몄꽌 ?띿뒪?몃? 異붿텧?섎뒗 以묒엯?덈떎.');

      const extracted = await extractTextFromFile(file, (message) => {
        updateProgress(`${index + 1}/${files.length} ${file.name}`, message);
      });

      policyDocuments.push(
        buildPolicyDocument({
          id: crypto.randomUUID(),
          name: file.name,
          sourceType: file.type || 'upload',
          pageCount: extracted.pageCount,
          text: extracted.text,
          previewUrl: extracted.previewUrl,
        }),
      );
    }

    hydratePolicyDocuments(policyDocuments, true);
    state.runLabel = `${files.length}媛??쎄? 臾몄꽌?먯꽌 蹂댁옣議곌굔???ㅼ떆 ?쎌뿀?듬땲??`;
  } catch (error) {
    console.error(error);
    state.error = error instanceof Error ? error.message : '?쎄? 臾몄꽌瑜?泥섎━?섏? 紐삵뻽?듬땲??';
  } finally {
    state.processing = false;
    render();
  }
}

async function processResponseFiles(files) {
  state.processing = true;
  state.error = '';
  updateProgress('蹂댄뿕???뚯떊 臾몄꽌瑜??쎈뒗 以묒엯?덈떎.', '異붽??쒕쪟 ?붿껌, 遺吏湲??ъ쑀, ?쎄? ?곸젏??李얠뒿?덈떎.');

  const responseDocuments = [];

  try {
    for (const [index, file] of files.entries()) {
      updateProgress(`${index + 1}/${files.length} ${file.name}`, '?뚯떊 臾몄꽌 ?띿뒪?몃? 異붿텧?섎뒗 以묒엯?덈떎.');

      const extracted = await extractTextFromFile(file, (message) => {
        updateProgress(`${index + 1}/${files.length} ${file.name}`, message);
      });

      responseDocuments.push(
        buildResponseDocument({
          id: crypto.randomUUID(),
          name: file.name,
          sourceType: file.type || 'upload',
          pageCount: extracted.pageCount,
          text: extracted.text,
          previewUrl: extracted.previewUrl,
        }),
      );
    }

    hydrateResponseDocuments(responseDocuments);
    state.runLabel = `${files.length}媛?蹂댄뿕???뚯떊 臾몄꽌?먯꽌 ????ъ씤?몃? ?뺣━?덉뒿?덈떎.`;
  } catch (error) {
    console.error(error);
    state.error = error instanceof Error ? error.message : '蹂댄뿕???뚯떊 臾몄꽌瑜?泥섎━?섏? 紐삵뻽?듬땲??';
  } finally {
    state.processing = false;
    render();
  }
}

function hydratePolicyDocuments(policyDocuments, rerenderAnalysis) {
  state.policyDocuments = policyDocuments;

  if (!policyDocuments.length) {
    resetPolicyInputs();
    if (rerenderAnalysis) {
      rerunAnalysisIfNeeded();
    }
    return;
  }

  state.policySummary = extractPolicyInsights(policyDocuments, defaultPolicyAssumptions);
  state.policyAutoAssumptions = { ...state.policySummary.detectedAssumptions };
  state.policyManualOverrides = {};
  syncSelectedProfileFromPolicySummary();
  recomputePolicyAssumptions();

  if (rerenderAnalysis) {
    rerunAnalysisIfNeeded();
  }
}

function hydrateResponseDocuments(responseDocuments) {
  state.responseDocuments = responseDocuments;
  refreshResponseSummary();
}

function refreshResponseSummary() {
  const manualDocument = buildManualResponseDocument();
  const combinedDocuments = manualDocument
    ? [...state.responseDocuments, manualDocument]
    : [...state.responseDocuments];

  state.responseSummary = combinedDocuments.length
    ? extractInsurerResponseInsights(combinedDocuments)
    : null;
}

function resetAll() {
  state.documents = [];
  state.analysis = null;
  state.error = '';
  resetPolicyInputs();
  state.selectedProfileId = 'samsung-fire';
  claimInsurerSelect.value = state.selectedProfileId;
  state.responseManualText = '';
  state.responseManualInsurer = 'unknown';
  responseInsurerSelect.value = 'unknown';
  responsePasteInput.value = '';
  hydrateResponseDocuments([]);
}

function resetPolicyInputs() {
  state.policyDocuments = [];
  state.policySummary = null;
  state.policyAutoAssumptions = {};
  state.policyManualOverrides = {};
  recomputePolicyAssumptions();
}

function rerunAnalysisIfNeeded() {
  state.analysis = state.documents.length
    ? analyzeClaimReadiness(state.documents, state.selectedProfileId, state.policyAssumptions)
    : null;
}

function mountClaimInsurerControls() {
  const container = document.createElement('div');
  container.className = 'insurer-picker';
  container.innerHTML = `
    <label class="field">
      <span>청구 기준 보험사</span>
      <select id="claim-insurer-select">
        ${CLAIM_PROFILE_OPTIONS.map(
          (option) => `<option value="${option.id}">${escapeHtml(option.label)}</option>`,
        ).join('')}
      </select>
    </label>
    <p class="field-help insurer-help" id="claim-insurer-help"></p>
  `;
  policySummaryCard.insertAdjacentElement('beforebegin', container);
  return container;
}

function syncSelectedProfileFromPolicySummary() {
  const matchedProfile = resolveClaimProfile(state.policySummary?.insurerName);
  if (!matchedProfile?.id) {
    return;
  }

  state.selectedProfileId = matchedProfile.id;
  claimInsurerSelect.value = matchedProfile.id;
}

function buildPolicyDocument({ id, name, text, sourceType, previewUrl, pageCount }) {
  const excerpt = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(' / ')
    .slice(0, 220);

  return {
    id,
    name,
    text,
    sourceType,
    previewUrl,
    pageCount,
    excerpt: excerpt || '?띿뒪??異붿텧 寃곌낵媛 異⑸텇?섏? ?딆뒿?덈떎.',
  };
}

function buildResponseDocument({ id, name, text, sourceType, previewUrl, pageCount }) {
  const excerpt = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(' / ')
    .slice(0, 220);

  return {
    id,
    name,
    text,
    sourceType,
    previewUrl,
    pageCount,
    excerpt: excerpt || '?띿뒪??異붿텧 寃곌낵媛 異⑸텇?섏? ?딆뒿?덈떎.',
  };
}

function buildManualResponseDocument() {
  const trimmed = state.responseManualText.trim();
  if (!trimmed) {
    return null;
  }

  const insurerPrefix =
    state.responseManualInsurer !== 'unknown'
      ? `${state.responseManualInsurer} 회신`
      : '보험사 회신';
  const excerpt = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(' / ')
    .slice(0, 220);

  return {
    id: 'manual-response',
    name: '붙여넣은 회신 내용',
    text: `${insurerPrefix}\n${trimmed}`,
    sourceType: 'manual',
    previewUrl: null,
    pageCount: 1,
    excerpt: excerpt || '직접 입력한 보험사 회신입니다.',
    isManual: true,
  };
}
function updateProgress(title, detail) {
  state.progressTitle = title;
  state.progressDetail = detail;
  renderProgress();
}

function renderProgress() {
  progressPanel.hidden = !state.processing;
  progressTitle.textContent = state.progressTitle;
  progressDetail.textContent = state.progressDetail;
}

function render() {
  renderProgress();
  renderMedicalDocuments();
  renderPolicyDocuments();
  renderClaimProfilePicker();
  renderPolicySummary();
  renderResponseDocuments();
  renderResponseSummary();

  runLabel.textContent = state.runLabel;
  downloadButton.disabled = !state.analysis;

  if (!state.analysis) {
    analysisRoot.className = 'analysis-placeholder';
    analysisRoot.innerHTML = state.error
      ? `<div class="error-card">${escapeHtml(state.error)}</div>`
      : '의료 서류, 약관, 보험사 회신을 올리면 준비도 분석 결과가 여기에 표시됩니다.';
    return;
  }

  analysisRoot.className = 'analysis-root';
  analysisRoot.innerHTML = renderAnalysis(state.analysis);
}

function renderClaimProfilePicker() {
  const profile = resolveClaimProfile(state.selectedProfileId);
  claimInsurerSelect.value = profile.id;
  claimInsurerHelp.textContent = `${profile.label} 기준으로 준비도, 제출 채널, 누락 서류 우선순위를 계산합니다. ${profile.referenceDate} 기준 안내를 반영합니다.`;
}

function renderMedicalDocuments() {
  if (!state.documents.length) {
    docsList.className = 'docs-list empty-state';
    docsList.innerHTML = state.error
      ? `<div class="error-card">${escapeHtml(state.error)}</div>`
      : '아직 업로드한 의료 서류가 없습니다. 샘플 케이스를 불러오거나 파일을 올려주세요.';
    return;
  }

  docsList.className = 'docs-list';
  docsList.innerHTML = state.documents.map(renderMedicalDocumentCard).join('');
}

function renderPolicyDocuments() {
  if (!state.policyDocuments.length) {
    policyDocsList.className = 'docs-list empty-state';
    policyDocsList.innerHTML = '아직 업로드한 약관 문서가 없습니다.';
    return;
  }

  policyDocsList.className = 'docs-list policy-docs-list';
  policyDocsList.innerHTML = state.policyDocuments.map(renderPolicyDocumentCard).join('');
}

function renderResponseDocuments() {
  const manualDocument = buildManualResponseDocument();
  const displayDocuments = manualDocument
    ? [...state.responseDocuments, manualDocument]
    : [...state.responseDocuments];

  if (!displayDocuments.length) {
    responseDocsList.className = 'docs-list empty-state';
    responseDocsList.innerHTML = '아직 분석할 보험사 회신이 없습니다.';
    return;
  }

  responseDocsList.className = 'docs-list response-docs-list';
  responseDocsList.innerHTML = displayDocuments
    .map((document) =>
      document.isManual ? renderManualResponseDocumentCard(document) : renderResponseDocumentCard(document),
    )
    .join('');
}

function renderPolicySummary() {
  const hasManualOverrides = Object.keys(state.policyManualOverrides).length > 0;
  const detectedFields = state.policySummary?.detectedFields || [];
  const notes = state.policySummary?.notes || [];

  if (!state.policySummary) {
    policySourceTitle.textContent = '기본 가정값 사용 중';
    policySourcePill.textContent = 'manual';
    policySourcePill.dataset.mode = 'manual';
    policySourceNote.textContent =
      '약관이나 보험증권을 올리면 보상비율, 공제액, 한도 등을 자동으로 읽어 추정 기준에 반영합니다.';
    policySummaryGrid.innerHTML = buildPolicyFallbackCards();
    policySummaryNotes.innerHTML = '';
    policyFieldHelp.textContent =
      '현재는 기본 가정값으로 계산합니다. 숫자가 다르면 아래 입력칸에서 직접 보정할 수 있습니다.';
    return;
  }

  const insurerName = state.policySummary.insurerName || '보험사 미확인';
  const productName = state.policySummary.productName ? ` / ${state.policySummary.productName}` : '';

  policySourceTitle.textContent = `${insurerName}${productName}`;
  policySourcePill.textContent = hasManualOverrides ? 'auto + manual' : 'auto';
  policySourcePill.dataset.mode = hasManualOverrides ? 'mixed' : 'auto';
  policySourceNote.textContent = hasManualOverrides
    ? `약관에서 추출한 ${detectedFields.length}개 조건을 불러온 뒤 일부 값을 수동으로 보정했습니다.`
    : `약관에서 추출한 ${detectedFields.length}개 조건을 자동으로 추정 계산에 반영했습니다.`;

  policySummaryGrid.innerHTML = detectedFields.length
    ? detectedFields.map(renderPolicyFieldCard).join('')
    : buildPolicyFallbackCards();

  policySummaryNotes.innerHTML = notes.length
    ? notes.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>약관에서 추출한 수치 조건을 기반으로 계산합니다.</li>';

  policyFieldHelp.textContent = hasManualOverrides
    ? '수동 보정값이 우선 적용됩니다. 원래 값으로 되돌리려면 "약관 기반 초기화"를 누르세요.'
    : '자동 추출값이 맞지 않으면 아래 입력칸에서 직접 수정할 수 있습니다.';
}

function renderResponseSummary() {
  if (!state.responseSummary) {
    responseSourceTitle.textContent = '회신 분석 대기';
    responseSourcePill.textContent = 'none';
    responseSourcePill.dataset.mode = 'manual';
    responseSummaryNote.textContent = '보험사 회신 파일을 올리거나 내용을 직접 붙여넣으면 쟁점을 정리합니다.';
    responseSummaryGrid.innerHTML = '';
    responseSummaryActions.innerHTML = '';
    return;
  }

  const severityLabelMap = {
    denial: '부지급/면책',
    partial: '일부지급/감액',
    request: '추가서류 요청',
    review: '심사 진행',
    received: '접수 확인',
    unknown: '회신 유형 미확인',
  };
  const responseCount = state.responseDocuments.length + (state.responseManualText.trim() ? 1 : 0);

  responseSourceTitle.textContent = state.responseSummary.insurerName
    ? `${state.responseSummary.insurerName} 회신 분석`
    : `${responseCount}건 회신 분석`;
  responseSourcePill.textContent = severityLabelMap[state.responseSummary.severity] || severityLabelMap.unknown;
  responseSourcePill.dataset.mode =
    state.responseSummary.severity === 'denial' || state.responseSummary.severity === 'partial'
      ? 'mixed'
      : 'auto';
  responseSummaryNote.textContent = state.responseSummary.summary;
  responseSummaryGrid.innerHTML = state.responseSummary.issueTypes.length
    ? state.responseSummary.issueTypes
        .map(
          (item) => `
            <article class="policy-chip-card">
              <span>쟁점</span>
              <strong>${escapeHtml(item)}</strong>
              <p>회신 문구에서 포착된 이슈입니다.</p>
            </article>
          `,
        )
        .join('')
    : `
        <article class="policy-chip-card fallback">
          <span>회신 결과</span>
          <strong>명확한 쟁점 미확인</strong>
          <p>원문을 더 붙여넣거나 파일을 추가하면 정확도가 올라갑니다.</p>
        </article>
      `;

  const actionItems = [
    ...state.responseSummary.actions,
    ...(state.responseSummary.sourceHints || []).map((item) => `공식 패턴 근거: ${item}`),
  ];

  responseSummaryActions.innerHTML = actionItems.length
    ? actionItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>추가 대응 제안이 아직 없습니다.</li>';
}

function renderMedicalDocumentCard(document) {
  const amount = document.amount ? `${currencyFormatter.format(document.amount)}원` : '금액 미확인';
  const issues = document.warnings.length
    ? `<div class="doc-foot">${document.warnings.map((item) => `<span class="tag warning">${escapeHtml(item)}</span>`).join('')}</div>`
    : '';

  return `
    <article class="doc-card">
      <div class="doc-head">
        <div>
          <span class="tag type">${escapeHtml(document.typeLabel)}</span>
          <h3>${escapeHtml(document.name)}</h3>
        </div>
        <span class="confidence">${Math.round(document.confidence * 100)}%</span>
      </div>
      <div class="doc-meta">
        <span>${escapeHtml(document.organization || '기관명 미확인')}</span>
        <span>${escapeHtml(document.primaryDate || '날짜 미확인')}</span>
        <span>${escapeHtml(amount)}</span>
      </div>
      <p class="doc-excerpt">${escapeHtml(document.excerpt)}</p>
      ${issues}
    </article>
  `;
}

function renderPolicyDocumentCard(document) {
  return `
    <article class="doc-card policy-doc-card">
      <div class="doc-head">
        <div>
          <span class="tag type">약관 문서</span>
          <h3>${escapeHtml(document.name)}</h3>
        </div>
        <span class="confidence">${document.pageCount}p</span>
      </div>
      <p class="doc-excerpt">${escapeHtml(document.excerpt)}</p>
    </article>
  `;
}

function renderResponseDocumentCard(document) {
  return `
    <article class="doc-card response-doc-card">
      <div class="doc-head">
        <div>
          <span class="tag type">보험사 회신</span>
          <h3>${escapeHtml(document.name)}</h3>
        </div>
        <span class="confidence">${document.pageCount}p</span>
      </div>
      <p class="doc-excerpt">${escapeHtml(document.excerpt)}</p>
    </article>
  `;
}

function renderManualResponseDocumentCard(document) {
  return `
    <article class="doc-card response-doc-card">
      <div class="doc-head">
        <div>
          <span class="tag type">붙여넣기 회신</span>
          <h3>${escapeHtml(document.name)}</h3>
        </div>
        <span class="confidence">paste</span>
      </div>
      <p class="doc-excerpt">${escapeHtml(document.excerpt)}</p>
    </article>
  `;
}

function renderPolicyFieldCard(field) {
  return `
    <article class="policy-chip-card">
      <span>${escapeHtml(field.label)}</span>
      <strong>${escapeHtml(field.displayValue)}</strong>
      <p>${escapeHtml(field.source)}</p>
    </article>
  `;
}

function buildPolicyFallbackCards() {
  const assumptions = [
    { label: '보상비율', value: `${Math.round(state.policyAssumptions.coverageRate * 100)}%` },
    { label: '통원 공제', value: formatMoney(state.policyAssumptions.outpatientDeductible) },
    { label: '처방 공제', value: formatMoney(state.policyAssumptions.prescriptionDeductible) },
    { label: '연간 한도', value: formatMoney(state.policyAssumptions.annualLimit) },
  ];

  return assumptions
    .map(
      (item) => `
        <article class="policy-chip-card fallback">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
          <p>현재 입력된 기본 가정값입니다.</p>
        </article>
      `,
    )
    .join('');
}

function renderResponseAwareDispute() {
  if (!state.responseSummary) {
    return '';
  }

  const evidenceList = state.responseSummary.evidencePack.length
    ? state.responseSummary.evidencePack.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>즉시 추가 제출해야 할 자료는 아직 명확하지 않습니다.</li>';
  const matchedLines = state.responseSummary.matchedLines.length
    ? state.responseSummary.matchedLines.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>회신 원문에서 직접 매칭된 문장은 아직 없습니다.</li>';
  const sourceHints = state.responseSummary.sourceHints?.length
    ? state.responseSummary.sourceHints.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>공식 패턴 힌트는 아직 없습니다.</li>';

  return `
    <div class="analysis-grid compact-grid">
      <section class="result-block nested-block">
        <h4>회신서 핵심 문구</h4>
        <ul class="plain-list">${matchedLines}</ul>
      </section>
      <section class="result-block nested-block">
        <h4>즉시 준비할 추가 서류</h4>
        <ul class="plain-list">${evidenceList}</ul>
      </section>
      <section class="result-block nested-block">
        <h4>공식 패턴 힌트</h4>
        <ul class="plain-list">${sourceHints}</ul>
      </section>
    </div>
  `;
}

function renderAnalysis(analysis) {
  const adminChecklist = analysis.adminChecklist.length
    ? analysis.adminChecklist.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>행정 체크리스트가 없습니다.</li>';
  const officialNotes = analysis.officialNotes.length
    ? analysis.officialNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>추가 공식 안내 메모가 없습니다.</li>';
  const decisionReasons = analysis.decision.reasons.length
    ? analysis.decision.reasons.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>판정 근거를 아직 정리하지 못했습니다.</li>';
  const decisionPositives = analysis.decision.positives.length
    ? analysis.decision.positives.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>긍정 신호가 아직 충분하지 않습니다.</li>';
  const estimateAssumptions = analysis.estimate.assumptions.length
    ? analysis.estimate.assumptions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>추정 가정이 없습니다.</li>';
  const estimateBlockers = analysis.estimate.blockers.length
    ? analysis.estimate.blockers.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>현재 입력 기준으로 큰 제한 요인은 보이지 않습니다.</li>';
  const disputeIssues = analysis.disputeGuide.issues.length
    ? analysis.disputeGuide.issues.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>현재 확인된 분쟁 쟁점이 없습니다.</li>';
  const disputeEvidence = analysis.disputeGuide.evidencePack.length
    ? analysis.disputeGuide.evidencePack.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>즉시 보강해야 할 증빙은 아직 없습니다.</li>';
  const disputeSteps = analysis.disputeGuide.steps.length
    ? analysis.disputeGuide.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>추가 대응 단계가 없습니다.</li>';
  const checklist = analysis.checklist
    .map(
      (item) => `
        <li class="${item.found ? 'is-found' : 'is-missing'}">
          <div>
            <strong>${escapeHtml(item.label)}</strong>
            <p>${escapeHtml(item.reason)}</p>
          </div>
          <span>${item.found ? '확인됨' : '부족'}</span>
        </li>
      `,
    )
    .join('');
  const highlights = analysis.highlights.length
    ? analysis.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>핵심 관찰 포인트가 없습니다.</li>';
  const nextActions = analysis.nextActions.length
    ? analysis.nextActions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>추가 행동 제안이 없습니다.</li>';
  const missing = analysis.missingDocuments.length
    ? analysis.missingDocuments.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>중요 누락 서류는 없습니다. 최종 제출 양식만 확인하면 됩니다.</li>';
  const notes = analysis.notes.length
    ? analysis.notes.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>추가 메모가 없습니다.</li>';
  const responseActions =
    state.responseSummary && state.responseSummary.actions.length
      ? state.responseSummary.actions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
      : '<li>추가 회신 대응 액션이 없습니다.</li>';

  return `
    <div class="analysis-banner">
      <div>
        <span class="tag insurer">${escapeHtml(analysis.profileLabel)}</span>
        <p class="banner-text">${escapeHtml(analysis.basisLabel)} (${escapeHtml(analysis.referenceDate)} 기준)</p>
      </div>
      <div class="banner-side">
        <strong>${escapeHtml(analysis.channelGuide.title)}</strong>
        <p>${escapeHtml(analysis.channelGuide.detail)}</p>
      </div>
    </div>

    <div class="decision-strip verdict-${analysis.decision.verdict}">
      <div>
        <span class="decision-kicker">판정 추정</span>
        <h3>${escapeHtml(analysis.decision.label)}</h3>
        <p>${escapeHtml(analysis.decision.description)}</p>
      </div>
      <div class="decision-note">참고용 추정이며 실제 보험사 심사 결과를 확정하지 않습니다.</div>
    </div>

    <div class="score-hero">
      <div class="score-ring" style="--score:${analysis.score};">
        <div class="score-ring-inner">
          <strong>${analysis.score}</strong>
          <span>/ 100</span>
        </div>
      </div>
      <div class="score-copy">
        <span class="status-pill">${escapeHtml(analysis.status)}</span>
        <h3>${escapeHtml(analysis.summaryTitle)}</h3>
        <p>${escapeHtml(analysis.summaryText)}</p>
      </div>
    </div>

    <section class="result-block estimate-block">
      <div class="estimate-head">
        <div>
          <h4>예상 수령액 추정</h4>
          <p>${escapeHtml(analysis.estimate.methodNote)}</p>
        </div>
        <div class="estimate-total">${escapeHtml(analysis.estimate.rangeLabel)}</div>
      </div>
      ${renderEstimateSource()}
      <div class="estimate-cards">
        <article>
          <span>실손 추정액</span>
          <strong>${escapeHtml(analysis.estimate.actualLossLabel)}</strong>
        </article>
        <article>
          <span>정액 특약 추정액</span>
          <strong>${escapeHtml(analysis.estimate.fixedLabel)}</strong>
        </article>
      </div>
      <div class="analysis-grid compact-grid">
        <section class="result-block nested-block">
          <h4>추정 가정</h4>
          <ul class="plain-list">${estimateAssumptions}</ul>
        </section>
        <section class="result-block nested-block">
          <h4>제한 요인</h4>
          <ul class="plain-list">${estimateBlockers}</ul>
        </section>
      </div>
    </section>

    <div class="analysis-grid">
      <section class="result-block">
        <h4>서류 체크리스트</h4>
        <ul class="checklist">${checklist}</ul>
      </section>

      <section class="result-block">
        <h4>지금 부족한 서류</h4>
        <ul class="plain-list">${missing}</ul>
      </section>

      <section class="result-block">
        <h4>핵심 관찰</h4>
        <ul class="plain-list">${highlights}</ul>
      </section>

      <section class="result-block">
        <h4>판정 근거</h4>
        <ul class="plain-list">${decisionReasons}</ul>
      </section>

      <section class="result-block">
        <h4>긍정 신호</h4>
        <ul class="plain-list">${decisionPositives}</ul>
      </section>

      <section class="result-block">
        <h4>다음 행동</h4>
        <ul class="plain-list">${nextActions}</ul>
      </section>

      <section class="result-block">
        <h4>제출 전 행정 체크</h4>
        <ul class="plain-list">${adminChecklist}</ul>
      </section>

      <section class="result-block">
        <h4>공식 안내 메모</h4>
        <ul class="plain-list">${officialNotes}</ul>
      </section>
    </div>

    <section class="result-block dispute-block">
      <h4>보험사 회신/부지급 대응 가이드</h4>
      <p>${escapeHtml(analysis.disputeGuide.summary)}</p>
      <div class="analysis-grid compact-grid">
        <section class="result-block nested-block">
          <h4>예상 쟁점</h4>
          <ul class="plain-list">${disputeIssues}</ul>
        </section>
        <section class="result-block nested-block">
          <h4>추가 제출팩</h4>
          <ul class="plain-list">${disputeEvidence}</ul>
        </section>
      </div>
      ${renderResponseAwareDispute()}
      ${state.responseSummary ? `<h4>회신 기반 추가 액션</h4><ul class="plain-list">${responseActions}</ul>` : ''}
      <h4>대응 단계</h4>
      <ul class="plain-list">${disputeSteps}</ul>
      <h4>재심사 요청 문안</h4>
      <pre class="message-template">${escapeHtml(analysis.disputeGuide.messageTemplate)}</pre>
    </section>

    <section class="result-block report-block">
      <h4>리포트 요약</h4>
      <p>${escapeHtml(analysis.reportPreview)}</p>
      <ul class="plain-list subtle">${notes}</ul>
    </section>

    ${renderExtractionDebugPanel()}
  `;
}

function renderExtractionDebugPanel() {
  if (!state.documents.length) {
    return '';
  }

  return `
    <section class="result-block debug-block">
      <div class="debug-head">
        <div>
          <h4>문서 추출 디버그</h4>
          <p>실제 업로드 서류에서 어떤 값이 잡혔는지, 어디가 비어 있는지 바로 확인합니다.</p>
        </div>
        <span class="debug-count">${state.documents.length}건</span>
      </div>
      <div class="debug-card-list">
        ${state.documents.map(renderExtractionDebugCard).join('')}
      </div>
    </section>
  `;
}

function renderExtractionDebugCard(document) {
  const visitTypeMap = {
    inpatient: '입원',
    outpatient: '통원',
    unknown: '판별 전',
  };
  const missingFields = [];

  if (!document.organization) {
    missingFields.push('기관명');
  }

  if (!document.primaryDate) {
    missingFields.push('날짜');
  }

  if (!document.amount && ['hospitalReceipt', 'claimDetail', 'pharmacyReceipt'].includes(document.type)) {
    missingFields.push('금액');
  }

  const issueList = [...missingFields.map((item) => `${item} 미추출`), ...document.warnings];
  const status = issueList.length ? 'check' : 'ok';
  const statusLabel = status === 'ok' ? '안정' : '확인 필요';
  const amountLabel = document.amount ? `${currencyFormatter.format(document.amount)}원` : '미추출';
  const confidenceLabel = `${Math.round((document.confidence || 0) * 100)}%`;
  const issueMarkup = issueList.length
    ? issueList.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>핵심 필드가 안정적으로 추출되었습니다.</li>';

  return `
    <article class="debug-card" data-status="${status}">
      <div class="debug-card-head">
        <div>
          <span class="tag type">${escapeHtml(document.typeLabel)}</span>
          <h5>${escapeHtml(document.name)}</h5>
        </div>
        <span class="debug-status">${statusLabel}</span>
      </div>
      <div class="debug-meta">
        <span>분류 신뢰도 ${escapeHtml(confidenceLabel)}</span>
        <span>${escapeHtml(visitTypeMap[document.visitType] || visitTypeMap.unknown)}</span>
      </div>
      <dl class="debug-fields">
        <div>
          <dt>기관명</dt>
          <dd>${escapeHtml(document.organization || '미추출')}</dd>
        </div>
        <div>
          <dt>날짜</dt>
          <dd>${escapeHtml(document.primaryDate || '미추출')}</dd>
        </div>
        <div>
          <dt>금액</dt>
          <dd>${escapeHtml(amountLabel)}</dd>
        </div>
        <div>
          <dt>환자명</dt>
          <dd>${escapeHtml(document.patientName || '미추출')}</dd>
        </div>
      </dl>
      <p class="debug-excerpt">${escapeHtml(document.excerpt)}</p>
      <ul class="plain-list subtle debug-issues">${issueMarkup}</ul>
    </article>
  `;
}

function renderEstimateSource() {
  const hasManualOverrides = Object.keys(state.policyManualOverrides).length > 0;

  if (!state.policySummary) {
    return `
      <div class="policy-estimate-banner">
        <strong>추정 기준: 기본 가정값 사용</strong>
        <p>보험증권이나 약관을 아직 올리지 않아 현재 입력값을 기준으로 예상 수령액을 계산했습니다.</p>
      </div>
    `;
  }

  const insurerName = state.policySummary.insurerName || '보험사 미확인';
  const productName = state.policySummary.productName ? ` / ${state.policySummary.productName}` : '';
  const summaryText = hasManualOverrides
    ? '약관에서 읽은 조건 위에 일부 수동 보정값을 덮어써서 계산했습니다.'
    : '약관에서 읽은 자동 추출 조건을 기준으로 계산했습니다.';

  return `
    <div class="policy-estimate-banner">
      <strong>추정 기준: ${escapeHtml(insurerName + productName)}</strong>
      <p>${escapeHtml(summaryText)}</p>
    </div>
  `;
}

function buildDownloadReport() {
  const baseReport = createReportText(state.analysis, state.documents);
  const lines = ['', '[약관/보험증권 기준]'];

  if (!state.policySummary) {
    lines.push('- 약관 문서 없음');
    lines.push(`- 기본 보상비율: ${Math.round(state.policyAssumptions.coverageRate * 100)}%`);
    lines.push(`- 통원 공제: ${formatMoney(state.policyAssumptions.outpatientDeductible)}`);
    lines.push(`- 처방 공제: ${formatMoney(state.policyAssumptions.prescriptionDeductible)}`);
    lines.push(`- 연간 한도: ${formatMoney(state.policyAssumptions.annualLimit)}`);
  } else {
    lines.push(`- 보험사: ${state.policySummary.insurerName || '미확인'}`);
    lines.push(`- 상품명: ${state.policySummary.productName || '미확인'}`);
    lines.push(`- 약관 문서 수: ${state.policyDocuments.length}건`);
    lines.push(`- 추출한 조건 수: ${state.policySummary.detectedFields.length}개`);
    lines.push(
      ...state.policySummary.detectedFields.map(
        (field) => `- ${field.label}: ${field.displayValue} (${field.source})`,
      ),
    );

    if (Object.keys(state.policyManualOverrides).length > 0) {
      lines.push('- 일부 약관 조건은 수동 입력값으로 보정함');
    }

    if (state.policySummary.notes.length) {
      lines.push('', '[약관 추출 메모]');
      lines.push(...state.policySummary.notes.map((item) => `- ${item}`));
    }
  }

  if (state.responseSummary) {
    const responseDocumentCount = state.responseDocuments.length + (state.responseManualText.trim() ? 1 : 0);

    lines.push('', '[보험사 회신 분석]');
    lines.push(`- 회신 보험사: ${state.responseSummary.insurerName || '미확인'}`);
    lines.push(`- 회신 문서 수: ${responseDocumentCount}건`);
    lines.push(`- 회신 유형: ${state.responseSummary.severity}`);
    lines.push(`- 요약: ${state.responseSummary.summary}`);

    if (state.responseManualText.trim()) {
      lines.push('- 붙여넣은 회신 텍스트 포함');
    }

    lines.push(...state.responseSummary.issueTypes.map((item) => `- 쟁점: ${item}`));
    lines.push(...state.responseSummary.evidencePack.map((item) => `- 추가 제출팩: ${item}`));
    lines.push(...state.responseSummary.actions.map((item) => `- 대응 액션: ${item}`));
    lines.push(...(state.responseSummary.sourceHints || []).map((item) => `- 공식 패턴 힌트: ${item}`));
  }

  return `${baseReport}\n${lines.join('\n')}`;
}
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

loadDemoCase('outpatient-gap');


