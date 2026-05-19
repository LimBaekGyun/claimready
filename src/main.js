import './style.css';
import {
  CLAIM_PROFILE_OPTIONS,
  analyzeClaimReadiness,
  buildDocumentRecord,
  compareClaimProfiles,
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
  activePage: 'claim',
  documents: [],
  policyDocuments: [],
  responseDocuments: [],
  responseManualText: '',
  responseManualInsurer: 'unknown',
  selectedProfileId: 'samsung-fire',
  analysis: null,
  comparison: null,
  policySummary: null,
  responseSummary: null,
  policyAutoAssumptions: {},
  policyManualOverrides: {},
  policyAssumptions: { ...defaultPolicyAssumptions },
  processing: false,
  progressTitle: '',
  progressDetail: '',
  error: '',
  runLabel: '아직 분석을 실행하지 않았습니다.',
};

app.innerHTML = `
  <div class="backdrop"></div>
  <main class="shell">
    <section class="hero panel">
      <div class="hero-copy">
        <span class="eyebrow">ClaimReady Beta</span>
        <h1>보험 청구 준비도와 예상 수령액을 같이 보는 AI 도구</h1>
        <p class="hero-text">
          병원 서류를 올리면 준비도와 누락 서류를 정리하고, 보험증권이나 약관을 함께 올리면
          기본 가정이 아닌 <strong>업로드한 약관 내용</strong>으로 예상 수령액을 다시 계산합니다.
        </p>
      </div>
      <div class="hero-stat">
        <div class="stat">
          <span class="stat-label">의료 서류</span>
          <strong>영수증 / 세부내역서 / 처방전 / 진단서</strong>
        </div>
        <div class="stat">
          <span class="stat-label">보험 자료</span>
          <strong>보험증권 / 약관 PDF / 이미지</strong>
        </div>
        <div class="stat">
          <span class="stat-label">출력</span>
          <strong>준비도 + 지급 추정 + 대응 가이드</strong>
        </div>
        <div class="stat">
          <span class="stat-label">기준</span>
          <strong>보험사별 안내 + 업로드 약관 추출</strong>
        </div>
      </div>
    </section>

    <nav class="page-tabs" aria-label="ClaimReady 페이지">
      <button class="page-tab" type="button" data-page="claim">
        <span>1페이지</span>
        <strong>서류 · 예상 보험금 찾기</strong>
      </button>
      <button class="page-tab" type="button" data-page="comparison">
        <span>2페이지</span>
        <strong>보험사 비교</strong>
      </button>
    </nav>

    <section class="workspace page-view" id="claim-page">
      <div class="left-column">
        <section class="panel control-panel">
          <div class="section-head">
            <div>
              <span class="section-kicker">1. 의료 서류</span>
              <h2>청구 서류 업로드</h2>
            </div>
            <span class="support-chip">준비도 분석</span>
          </div>

          <label class="dropzone" id="dropzone" for="file-input">
            <input id="file-input" type="file" multiple accept="image/*,.pdf,.txt" />
            <div class="dropzone-copy">
              <strong>영수증, 세부내역서, 처방전, 진단서 등을 올리세요</strong>
              <p>이미지, PDF, TXT를 지원합니다. OCR 또는 PDF 텍스트 추출 후 문서 유형과 누락 항목을 정리합니다.</p>
            </div>
          </label>

          <div class="cta-row">
            <button class="button button-strong" type="button" data-demo-case="outpatient-gap">샘플 케이스 A</button>
            <button class="button" type="button" data-demo-case="inpatient-ready">샘플 케이스 B</button>
            <button class="button button-muted" type="button" id="clear-button">전체 초기화</button>
          </div>

          <div class="helper-grid">
            <article>
              <strong>샘플 A</strong>
              <p>통원 치료 후 영수증, 세부내역서, 처방전이 있고 약관까지 같이 적용한 예시입니다.</p>
            </article>
            <article>
              <strong>샘플 B</strong>
              <p>입원 청구에 필요한 주요 서류가 거의 갖춰진 상태를 보여줍니다.</p>
            </article>
          </div>
        </section>

        <section class="panel policy-panel">
          <div class="section-head">
            <div>
              <span class="section-kicker">2. 보험증권 / 약관</span>
              <h2>보장조건 자동 추출</h2>
            </div>
            <span class="support-chip">예상 수령액 보정</span>
          </div>

          <label class="dropzone dropzone-compact" id="policy-dropzone" for="policy-file-input">
            <input id="policy-file-input" type="file" multiple accept="image/*,.pdf,.txt" />
            <div class="dropzone-copy">
              <strong>보험증권, 상품설명서, 약관 PDF를 올리세요</strong>
              <p>보상비율, 통원 공제, 처방 공제, 연간 한도, 진단비, 수술비를 자동 추출해 추정식에 반영합니다.</p>
            </div>
          </label>

          <div class="cta-row">
            <button class="button" type="button" id="policy-reset-button">약관값만 초기화</button>
          </div>

          <div class="policy-summary-card" id="policy-summary-card">
            <div class="policy-summary-head">
              <div>
                <span class="policy-kicker">현재 기준</span>
                <h3 id="policy-source-title">기본 가정값 사용 중</h3>
              </div>
              <span class="policy-source-pill" id="policy-source-pill">manual</span>
            </div>
            <p class="policy-source-note" id="policy-source-note">
              아직 보험증권이나 약관을 올리지 않았습니다. 아래 입력치는 기본 가정값입니다.
            </p>
            <div class="policy-summary-grid" id="policy-summary-grid"></div>
            <ul class="plain-list subtle" id="policy-summary-notes"></ul>
          </div>

          <div class="section-head compact section-head-inline">
            <div>
              <span class="section-kicker">3. 수동 보정</span>
              <h2>자동 추출값 수정</h2>
            </div>
          </div>

          <div class="policy-grid">
            <label class="field">
              <span>실손 보상비율</span>
              <select id="coverage-rate">
                <option value="0.9">90%</option>
                <option value="0.8">80%</option>
                <option value="0.7">70%</option>
              </select>
            </label>
            <label class="field">
              <span>통원 공제액</span>
              <input id="outpatient-deductible" type="number" min="0" step="1000" />
            </label>
            <label class="field">
              <span>처방 조제 공제액</span>
              <input id="prescription-deductible" type="number" min="0" step="1000" />
            </label>
            <label class="field">
              <span>입원 공제액</span>
              <input id="inpatient-deductible" type="number" min="0" step="1000" />
            </label>
            <label class="field">
              <span>연간 한도</span>
              <input id="annual-limit" type="number" min="0" step="10000" />
            </label>
            <label class="field">
              <span>진단비 특약</span>
              <input id="diagnosis-benefit" type="number" min="0" step="10000" />
            </label>
            <label class="field">
              <span>수술비 특약</span>
              <input id="surgery-benefit" type="number" min="0" step="10000" />
            </label>
            <label class="field">
              <span>이미 지급받은 금액</span>
              <input id="already-paid" type="number" min="0" step="10000" />
            </label>
          </div>
          <p class="field-help" id="policy-field-help">
            약관 업로드 전에는 기본 가정값을 사용합니다. 약관을 올리면 자동 추출값으로 바뀌고, 이 입력칸에서 다시 덮어쓸 수 있습니다.
          </p>

          <div class="section-head compact section-head-inline">
            <div>
              <span class="section-kicker">4. 약관 문서</span>
              <h2>추출에 사용한 문서</h2>
            </div>
          </div>
          <div id="policy-docs-list" class="docs-list empty-state">
            아직 약관 문서가 없습니다.
          </div>
        </section>

        <section class="panel response-panel">
          <div class="section-head">
            <div>
              <span class="section-kicker">5. 보험사 회신</span>
              <h2>추가서류 요청 / 부지급 통보</h2>
            </div>
            <span class="support-chip">분쟁 대응용</span>
          </div>

          <label class="dropzone dropzone-compact" id="response-dropzone" for="response-file-input">
            <input id="response-file-input" type="file" multiple accept="image/*,.pdf,.txt" />
            <div class="dropzone-copy">
              <strong>보험사 문자, 추가서류 요청서, 부지급 안내문을 올리세요</strong>
              <p>보험사가 실제로 잡은 쟁점을 읽어 무엇을 더 준비해야 하는지 따로 정리합니다.</p>
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
                <span class="policy-kicker">회신 분석</span>
                <h3 id="response-source-title">회신 문서 없음</h3>
              </div>
              <span class="policy-source-pill" id="response-source-pill">none</span>
            </div>
            <p class="policy-source-note" id="response-summary-note">
              아직 보험사 회신 문서를 올리지 않았습니다.
            </p>
            <div class="policy-summary-grid" id="response-summary-grid"></div>
            <ul class="plain-list subtle" id="response-summary-actions"></ul>
          </div>

          <div class="section-head compact section-head-inline">
            <div>
              <span class="section-kicker">6. 회신 문서</span>
              <h2>추출에 사용한 회신</h2>
            </div>
          </div>
          <div id="response-docs-list" class="docs-list empty-state">
            아직 회신 문서가 없습니다.
          </div>
        </section>

        <section class="panel progress-panel" id="progress-panel" hidden>
          <div class="section-head compact">
            <div>
              <span class="section-kicker">처리 중</span>
              <h2 id="progress-title">문서를 분석하는 중입니다.</h2>
            </div>
          </div>
          <p id="progress-detail" class="muted"></p>
        </section>

        <section class="panel docs-panel">
          <div class="section-head">
            <div>
              <span class="section-kicker">7. 완료 문서 묶음</span>
              <h2>업로드한 서류</h2>
            </div>
            <span class="muted" id="run-label">아직 분석을 실행하지 않았습니다.</span>
          </div>
          <div id="docs-list" class="docs-list empty-state">
            아직 의료 서류가 없습니다. 샘플 케이스를 누르면 바로 결과를 볼 수 있습니다.
          </div>
        </section>
      </div>

      <div class="right-column">
        <section class="panel result-panel">
          <div class="section-head">
            <div>
              <span class="section-kicker">8. 1페이지 결과</span>
              <h2>필요 서류와 예상 보험금</h2>
            </div>
            <button class="button button-muted" type="button" id="download-button" disabled>리포트 다운로드</button>
          </div>
          <div id="analysis-root" class="analysis-placeholder">
            준비도 점수, 누락 서류, 예상 수령액, 부지급 대응 가이드를 여기에 보여줍니다.
          </div>
        </section>
      </div>
    </section>

    <section class="workspace page-view comparison-page" id="comparison-page" hidden>
      <div class="left-column">
        <section class="panel comparison-intro-panel">
          <div class="section-head">
            <div>
              <span class="section-kicker">2페이지</span>
              <h2>보험사 비교</h2>
            </div>
            <span class="support-chip">청구 기준 추천</span>
          </div>
          <p class="page-copy">
            1페이지에서 올린 의료 서류와 약관 가정값을 그대로 사용해, 현재 등록된 보험사별 청구 준비 부담을 비교합니다.
            보험상품 가입 추천이 아니라 <strong>이번 청구 접수 관점</strong>의 비교입니다.
          </p>
          <div class="cta-row">
            <button class="button button-strong" type="button" id="comparison-to-claim-button">서류 분석 페이지로 이동</button>
          </div>
        </section>

        <section class="panel comparison-input-panel">
          <div class="section-head">
            <div>
              <span class="section-kicker">비교 입력값</span>
              <h2>현재 비교에 쓰는 자료</h2>
            </div>
          </div>
          <div id="comparison-input-summary" class="comparison-input-summary empty-state">
            아직 비교할 의료 서류가 없습니다.
          </div>
        </section>
      </div>

      <div class="right-column">
        <section class="panel result-panel comparison-result-panel">
          <div class="section-head">
            <div>
              <span class="section-kicker">보험사 랭킹</span>
              <h2>현재 서류 기준 추천</h2>
            </div>
            <button class="button button-muted" type="button" id="comparison-download-button" disabled>리포트 다운로드</button>
          </div>
          <div id="comparison-root" class="analysis-placeholder">
            1페이지에서 의료 서류를 올리면 보험사 비교 결과가 여기에 표시됩니다.
          </div>
        </section>
      </div>
    </section>
  </main>
`;

const claimPage = document.querySelector('#claim-page');
const comparisonPage = document.querySelector('#comparison-page');
const pageTabButtons = document.querySelectorAll('[data-page]');
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
const comparisonRoot = document.querySelector('#comparison-root');
const comparisonInputSummary = document.querySelector('#comparison-input-summary');
const comparisonToClaimButton = document.querySelector('#comparison-to-claim-button');
const downloadButton = document.querySelector('#download-button');
const comparisonDownloadButton = document.querySelector('#comparison-download-button');
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

pageTabButtons.forEach((button) => {
  button.addEventListener('click', () => {
    state.activePage = button.dataset.page === 'comparison' ? 'comparison' : 'claim';
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

comparisonToClaimButton.addEventListener('click', () => {
  state.activePage = 'claim';
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

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
  state.runLabel = '전체 입력값을 초기화했습니다.';
  render();
});

policyResetButton.addEventListener('click', () => {
  resetPolicyInputs();
  state.runLabel = '약관 자동 추출값과 수동 보정값을 초기화했습니다.';
  rerunAnalysisIfNeeded();
  render();
});

downloadButton.addEventListener('click', downloadCurrentReport);
comparisonDownloadButton.addEventListener('click', downloadCurrentReport);

function downloadCurrentReport() {
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
}

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
    state.runLabel = '수동 보정값을 반영해 추정 결과를 다시 계산했습니다.';
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
  state.runLabel = `${demoCase.title} 샘플을 불러왔습니다.`;
  rerunAnalysisIfNeeded();
  render();
}

async function processMedicalFiles(files) {
  state.processing = true;
  state.error = '';
  state.documents = [];
  state.analysis = null;
  state.comparison = null;
  state.runLabel = `${files.length}개 의료 문서를 업로드했습니다.`;
  updateProgress('의료 서류를 준비하는 중입니다.', '첫 OCR 언어 로딩 때 몇 초 걸릴 수 있습니다.');

  const documents = [];

  try {
    for (const [index, file] of files.entries()) {
      updateProgress(`${index + 1}/${files.length} ${file.name}`, '의료 서류 텍스트를 추출하는 중입니다.');

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
    state.error = error instanceof Error ? error.message : '의료 문서를 처리하지 못했습니다.';
  } finally {
    state.processing = false;
    render();
  }
}

async function processPolicyFiles(files) {
  state.processing = true;
  state.error = '';
  updateProgress('보험증권과 약관을 읽는 중입니다.', '텍스트를 추출한 뒤 보장조건 정보를 찾습니다.');

  const policyDocuments = [];

  try {
    for (const [index, file] of files.entries()) {
      updateProgress(`${index + 1}/${files.length} ${file.name}`, '약관 문서 텍스트를 추출하는 중입니다.');

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
    state.runLabel = `${files.length}개 약관 문서에서 보장조건을 다시 읽었습니다.`;
  } catch (error) {
    console.error(error);
    state.error = error instanceof Error ? error.message : '약관 문서를 처리하지 못했습니다.';
  } finally {
    state.processing = false;
    render();
  }
}

async function processResponseFiles(files) {
  state.processing = true;
  state.error = '';
  updateProgress('보험사 회신 문서를 읽는 중입니다.', '추가서류 요청, 부지급 사유, 약관 쟁점을 찾습니다.');

  const responseDocuments = [];

  try {
    for (const [index, file] of files.entries()) {
      updateProgress(`${index + 1}/${files.length} ${file.name}`, '회신 문서 텍스트를 추출하는 중입니다.');

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
    state.runLabel = `${files.length}개 보험사 회신 문서에서 대응 포인트를 정리했습니다.`;
  } catch (error) {
    console.error(error);
    state.error = error instanceof Error ? error.message : '보험사 회신 문서를 처리하지 못했습니다.';
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
  state.comparison = null;
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
  if (!state.documents.length) {
    state.analysis = null;
    state.comparison = null;
    return;
  }

  state.analysis = analyzeClaimReadiness(state.documents, state.selectedProfileId, state.policyAssumptions);
  state.comparison = compareClaimProfiles(state.documents, state.policyAssumptions);
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
    excerpt: excerpt || '텍스트 추출 결과가 충분하지 않습니다.',
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
    excerpt: excerpt || '텍스트 추출 결과가 충분하지 않습니다.',
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
  renderPageNavigation();
  renderMedicalDocuments();
  renderPolicyDocuments();
  renderClaimProfilePicker();
  renderPolicySummary();
  renderResponseDocuments();
  renderResponseSummary();
  renderComparisonInputSummary();

  runLabel.textContent = state.runLabel;
  downloadButton.disabled = !state.analysis;
  comparisonDownloadButton.disabled = !state.analysis;

  if (!state.analysis) {
    analysisRoot.className = 'analysis-placeholder';
    analysisRoot.innerHTML = state.error
      ? `<div class="error-card">${escapeHtml(state.error)}</div>`
      : '의료 서류, 약관, 보험사 회신을 올리면 준비도 분석 결과가 여기에 표시됩니다.';
    comparisonRoot.className = 'analysis-placeholder';
    comparisonRoot.innerHTML = state.error
      ? `<div class="error-card">${escapeHtml(state.error)}</div>`
      : '1페이지에서 의료 서류를 올리거나 샘플 케이스를 불러오면 보험사 비교 결과가 표시됩니다.';
    return;
  }

  analysisRoot.className = 'analysis-root';
  analysisRoot.innerHTML = renderAnalysis(state.analysis);
  comparisonRoot.className = 'analysis-root comparison-root';
  comparisonRoot.innerHTML = renderComparisonPage();
}

function renderPageNavigation() {
  const isComparisonPage = state.activePage === 'comparison';
  claimPage.hidden = isComparisonPage;
  comparisonPage.hidden = !isComparisonPage;

  pageTabButtons.forEach((button) => {
    const isActive = button.dataset.page === state.activePage;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

function renderClaimProfilePicker() {
  const profile = resolveClaimProfile(state.selectedProfileId);
  claimInsurerSelect.value = profile.id;
  claimInsurerHelp.textContent = `${profile.label} 기준으로 준비도, 제출 채널, 누락 서류 우선순위를 계산합니다. 공식 출처 ${profile.source.verifiedDate} 확인, 다음 검토 ${profile.source.nextReviewDate} 기준입니다.`;
}

function renderComparisonInputSummary() {
  if (!state.documents.length) {
    comparisonInputSummary.className = 'comparison-input-summary empty-state';
    comparisonInputSummary.innerHTML = '아직 비교할 의료 서류가 없습니다. 1페이지에서 서류를 올리거나 샘플 케이스를 불러오세요.';
    return;
  }

  const documentTypes = state.documents
    .map((document) => document.typeLabel)
    .filter((label, index, collection) => collection.indexOf(label) === index)
    .join(', ');
  const policySource = state.policySummary
    ? `${state.policySummary.insurerName || '보험사 미확인'}${state.policySummary.productName ? ` / ${state.policySummary.productName}` : ''}`
    : '기본 가정값';
  const responseSource = state.responseSummary
    ? `${state.responseSummary.insurerName || '보험사 미확인'} 회신 반영`
    : '보험사 회신 없음';

  comparisonInputSummary.className = 'comparison-input-summary';
  comparisonInputSummary.innerHTML = `
    <div class="comparison-input-grid">
      <article>
        <span>의료 서류</span>
        <strong>${state.documents.length}건</strong>
        <p>${escapeHtml(documentTypes || '문서 유형 미확인')}</p>
      </article>
      <article>
        <span>예상 보험금 기준</span>
        <strong>${escapeHtml(policySource)}</strong>
        <p>보상비율 ${Math.round(state.policyAssumptions.coverageRate * 100)}%, 연간 한도 ${formatMoney(state.policyAssumptions.annualLimit)}</p>
      </article>
      <article>
        <span>분쟁/회신 자료</span>
        <strong>${escapeHtml(responseSource)}</strong>
        <p>${state.responseSummary ? escapeHtml(state.responseSummary.summary) : '추가서류 요청이나 부지급 통보가 있으면 비교 리스크 판단에 함께 반영합니다.'}</p>
      </article>
    </div>
  `;
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
    ? '수동 보정값이 우선 적용됩니다. 원래 값으로 되돌리려면 약관값만 초기화를 누르세요.'
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
              <p>회신 문구에서 포착한 이슈입니다.</p>
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
    : '<li>추가 대응 제안은 아직 없습니다.</li>';
}

function renderMedicalDocumentCard(document) {
  const warnings = document.warnings || [];
  const amount = document.amount ? `${currencyFormatter.format(document.amount)}원` : '금액 미확인';
  const issues = warnings.length
    ? `<div class="doc-foot">${warnings.map((item) => `<span class="tag warning">${escapeHtml(item)}</span>`).join('')}</div>`
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
    : '<li>회신 원문에서 직접 매칭한 문장은 아직 없습니다.</li>';
  const sourceHints = state.responseSummary.sourceHints?.length
    ? state.responseSummary.sourceHints.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>공식 패턴 힌트는 아직 없습니다.</li>';

  return `
    <div class="analysis-grid compact-grid">
      <section class="result-block nested-block">
        <h4>회신의 핵심 문구</h4>
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

function renderInsurerComparisonPanel() {
  const comparison = state.comparison;

  if (!comparison?.rankings?.length || !comparison.best) {
    return '';
  }

  const best = comparison.best;
  const bestReasons = best.reasons
    .slice(0, 3)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  const rankingCards = comparison.rankings
    .map((item, index) => {
      const cardClasses = [
        'comparison-rank-card',
        index === 0 ? 'is-best' : '',
        item.profileId === state.selectedProfileId ? 'is-current' : '',
      ]
        .filter(Boolean)
        .join(' ');
      const rankBadge = index === 0 ? '추천' : `${index + 1}위`;
      const digitalLabel = item.digitalEligible ? '디지털 접수 유리' : '원본/오프라인 확인';
      const missingLabel = item.mandatoryMissingCount
        ? `필수 누락 ${item.mandatoryMissingCount}건`
        : '필수 누락 없음';
      const currentBadge =
        item.profileId === state.selectedProfileId ? '<span class="comparison-current">현재 선택</span>' : '';

      return `
        <article class="${cardClasses}">
          <div class="comparison-card-head">
            <span class="comparison-rank">${escapeHtml(rankBadge)}</span>
            <div>
              <h5>${escapeHtml(item.profileLabel)}</h5>
              <p>${escapeHtml(item.channelTitle)}</p>
            </div>
            <strong>${item.recommendationScore}</strong>
          </div>
          <div class="comparison-meta">
            ${currentBadge}
            <span>${escapeHtml(item.status)}</span>
            <span>${escapeHtml(item.decisionLabel)}</span>
            <span>${escapeHtml(digitalLabel)}</span>
            <span>${escapeHtml(missingLabel)}</span>
            <span>${escapeHtml(item.sourceStatusLabel)}</span>
          </div>
          <p class="comparison-reason">${escapeHtml(item.reasonSummary)}</p>
          <div class="comparison-foot">
            <span>예상 ${escapeHtml(item.estimateRangeLabel)}</span>
            <span>준비도 ${item.score}/100</span>
          </div>
        </article>
      `;
    })
    .join('');

  return `
    <section class="result-block comparison-block">
      <div class="comparison-head">
        <div>
          <span class="decision-kicker">보험사 비교</span>
          <h4>현재 서류 기준 추천 보험사</h4>
          <p>${escapeHtml(comparison.summary)}</p>
        </div>
        <div class="comparison-best-score">
          <span>추천점수</span>
          <strong>${best.recommendationScore}</strong>
        </div>
      </div>

      <div class="comparison-best">
        <div>
          <span class="tag insurer">이번 청구 기준 추천</span>
          <h5>${escapeHtml(best.profileLabel)}</h5>
          <p>${escapeHtml(best.basisLabel)} (${escapeHtml(best.sourceVerifiedDate)} 공식 출처 확인 · 다음 검토 ${escapeHtml(best.sourceNextReviewDate)})</p>
        </div>
        <ul class="plain-list comparison-reasons">${bestReasons}</ul>
      </div>

      <div class="comparison-rank-list">${rankingCards}</div>
      <p class="comparison-disclaimer">${escapeHtml(comparison.disclaimer)}</p>
    </section>
  `;
}

function renderComparisonPage() {
  if (!state.comparison?.best) {
    return `
      <div class="analysis-placeholder">
        비교할 의료 서류가 아직 없습니다. 1페이지에서 서류를 올리면 현재 등록 보험사 기준 랭킹을 계산합니다.
      </div>
    `;
  }

  return `
    ${renderInsurerComparisonPanel()}
    <section class="result-block comparison-method-block">
      <h4>비교 기준</h4>
      <ul class="plain-list">
        <li>현재 앱에 등록된 보험사: 삼성화재, KB손해보험, DB손해보험, 메리츠화재, 현대해상</li>
        <li>점수는 준비도, 필수 누락 서류 수, 예상 수령액 제한 요인, 디지털 접수 가능성, 추가심사 쟁점을 합산해 계산합니다.</li>
        <li>공식 출처는 보험사별 안내 페이지와 청구서/PDF를 기준으로 90일마다 재확인하도록 표시합니다.</li>
        <li>보험상품 자체의 가격, 보장범위, 고객만족도 비교가 아니라 이번 청구 접수 준비 기준 비교입니다.</li>
      </ul>
    </section>
  `;
}

function renderSourceFreshness(source) {
  if (!source) {
    return '';
  }

  const sourceLinks = source.sources.length
    ? source.sources
        .map(
          (item) => `
            <li>
              <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.label)}</a>
            </li>
          `,
        )
        .join('')
    : '<li>등록된 공식 출처가 없습니다.</li>';
  const sourceNotes = source.notes.length
    ? source.notes.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>추가 검증 메모가 없습니다.</li>';

  return `
    <section class="source-freshness source-${escapeHtml(source.status)}">
      <div class="source-head">
        <div>
          <span class="decision-kicker">공식 출처 최신성</span>
          <h4>${escapeHtml(source.statusLabel)}</h4>
          <p>확인일 ${escapeHtml(source.verifiedDate || '미확인')} · 다음 검토 ${escapeHtml(source.nextReviewDate || '미정')} · ${escapeHtml(buildSourceReviewDistanceLabel(source))}</p>
        </div>
        <span class="source-status status-${escapeHtml(source.status)}">${escapeHtml(source.statusLabel)}</span>
      </div>
      <div class="source-grid">
        <div>
          <strong>확인한 공식 출처</strong>
          <ul class="source-links">${sourceLinks}</ul>
        </div>
        <div>
          <strong>반영 메모</strong>
          <ul class="plain-list">${sourceNotes}</ul>
        </div>
      </div>
    </section>
  `;
}

function buildSourceReviewDistanceLabel(source) {
  if (typeof source.daysUntilReview !== 'number') {
    return '검토 주기 미설정';
  }

  if (source.daysUntilReview < 0) {
    return `${Math.abs(source.daysUntilReview)}일 전 검토 기한 경과`;
  }

  if (source.daysUntilReview === 0) {
    return '오늘 재검토 필요';
  }

  return `${source.daysUntilReview}일 후 재검토`;
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
    : '<li>현재 입력 기준으로 제한 요인은 보이지 않습니다.</li>';
  const disputeIssues = analysis.disputeGuide.issues.length
    ? analysis.disputeGuide.issues.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>현재 확인한 분쟁 쟁점은 없습니다.</li>';
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
    : '<li>핵심 관찰 사항이 없습니다.</li>';
  const nextActions = analysis.nextActions.length
    ? analysis.nextActions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>추가 행동 제안은 없습니다.</li>';
  const missing = analysis.missingDocuments.length
    ? analysis.missingDocuments.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>중요 누락 서류는 없습니다. 최종 제출 양식만 확인하면 됩니다.</li>';
  const notes = analysis.notes.length
    ? analysis.notes.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>추가 메모가 없습니다.</li>';
  const responseActions =
    state.responseSummary && state.responseSummary.actions.length
      ? state.responseSummary.actions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
      : '<li>추가 회신 대응 액션은 없습니다.</li>';

  return `
    <div class="analysis-banner">
      <div>
        <span class="tag insurer">${escapeHtml(analysis.profileLabel)}</span>
        <p class="banner-text">${escapeHtml(analysis.basisLabel)} (${escapeHtml(analysis.source.verifiedDate)} 공식 출처 확인)</p>
      </div>
      <div class="banner-side">
        <strong>${escapeHtml(analysis.channelGuide.title)}</strong>
        <p>${escapeHtml(analysis.channelGuide.detail)}</p>
      </div>
    </div>

    ${renderSourceFreshness(analysis.source)}

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
          <p>업로드한 서류에서 어떤 값이 잡혔고 어디가 비었는지 확인합니다.</p>
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
    unknown: '유형 미확인',
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

  const issueList = [...missingFields.map((item) => `${item} 미추출`), ...(document.warnings || [])];
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
    ? '약관에서 읽은 조건 위에 일부 수동 보정값을 더해서 계산했습니다.'
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
  const lines = [];

  if (state.comparison?.best) {
    lines.push('', '[보험사 비교]');
    lines.push(
      `- 이번 청구 기준 추천: ${state.comparison.best.profileLabel} (${state.comparison.best.recommendationScore}/100)`,
    );
    lines.push(`- 요약: ${state.comparison.summary}`);
    lines.push(
      ...state.comparison.rankings
        .slice(0, 3)
        .map(
          (item, index) =>
            `- ${index + 1}위 ${item.profileLabel}: 추천점수 ${item.recommendationScore}/100, 준비도 ${item.score}/100, 출처 ${item.sourceVerifiedDate} 확인(${item.sourceStatusLabel}), ${item.reasonSummary}`,
        ),
    );
    lines.push(`- 주의: ${state.comparison.disclaimer}`);
  }

  lines.push('', '[약관/보험증권 기준]');

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
