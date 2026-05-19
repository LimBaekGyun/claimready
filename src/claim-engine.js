const currencyFormatter = new Intl.NumberFormat('ko-KR');
const CLAIM_SOURCE_VERIFIED_DATE = '2026-05-19';
const CLAIM_SOURCE_REVIEW_INTERVAL_DAYS = 90;
const SOURCE_REVIEW_WARNING_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const DOCUMENT_TYPE_LABELS = {
  hospitalReceipt: '진료비 영수증',
  claimDetail: '진료비 세부내역서',
  prescription: '처방전',
  pharmacyReceipt: '약국 영수증',
  diagnosisStatement: '진단서',
  admissionCertificate: '입퇴원확인서',
  claimForm: '보험금 청구서',
  insurerNotice: '보험사 회신',
  other: '기타 문서',
};

const CLAIM_PROFILES = [
  {
    id: 'samsung-fire',
    label: '삼성화재',
    aliases: ['samsung-fire', 'samsung', '삼성화재', '삼성화재해상보험'],
    basisLabel: '삼성화재 질병/상해 보험금청구 안내 기준',
    referenceDate: CLAIM_SOURCE_VERIFIED_DATE,
    source: defineOfficialSource([
      {
        label: '질병/상해 보험금청구',
        url: 'https://www.samsungfire.com/claim/P_P03_01_01_001.html',
      },
      {
        label: '질병/상해 보험금청구 필요서류',
        url: 'https://direct.samsungfire.com/m/claim/MP040202_001.html?tab=1',
      },
      {
        label: '질병/상해 보험금 청구 채널',
        url: 'https://direct.samsungfire.com/claim/PP040201_001.html?pcMode=true',
      },
    ], [
      '공식 청구 페이지에서 PC/모바일, 우편/방문 접수 흐름을 확인했습니다.',
      '다이렉트 안내의 200만원 초과 원본 제출 문구를 보수적 디지털 한도로 유지했습니다.',
    ]),
    channelGuide: {
      title: '모바일·홈페이지 우선',
      detail: '질병·상해 보험금청구 기준으로 모바일/홈페이지 채널을 우선 안내합니다.',
    },
    rules: {
      mobileLimit: 2000000,
      claimWindowYears: 3,
      outpatientDiagnosisThreshold: 30000,
      outpatientDetailThreshold: 50000,
      inpatientAltThreshold: 500000,
      digitalClaimFormOptional: true,
    },
    adminChecklist: [
      '질병·상해 보험금 청구는 모바일 또는 홈페이지 채널을 먼저 확인합니다.',
      '예상 청구금액이 200만원을 넘으면 원본 제출이나 별도 접수 채널을 함께 확인합니다.',
      '청구 사유 발생일로부터 3년 이내 접수 여부를 점검합니다.',
    ],
    officialNotes: [
      '실손 통원 청구는 진단명 확인 서류, 진료비/약제비 계산서, 세부내역서 필요 여부를 함께 확인합니다.',
      '질병분류기호가 기재된 처방전이 있으면 일부 통원 보완서류를 줄일 수 있습니다.',
    ],
  },
  {
    id: 'kb-insure',
    label: 'KB손해보험',
    aliases: ['kb-insure', 'kb', 'kb손해보험', 'lig손해보험'],
    basisLabel: 'KB손해보험 보험금청구 안내 기준',
    referenceDate: CLAIM_SOURCE_VERIFIED_DATE,
    source: defineOfficialSource([
      {
        label: '보험금청구안내',
        url: 'https://www.kbinsure.co.kr/CG205010001.ec',
      },
      {
        label: '필요서류 안내(질병)',
        url: 'https://www.kbinsure.co.kr/CG205020003.ec',
      },
      {
        label: '필요서류 안내(일반상해)',
        url: 'https://www.kbinsure.co.kr/pop/CG205020001.ec',
      },
    ], [
      '실손 통원 3만원 초과 10만원 이하 처방전 대체 기준과 비급여 세부내역서 예외를 확인했습니다.',
      '5천만원 이상, 사망보험금, 위임 청구는 우편/방문 원본 제출 필요 문구를 반영했습니다.',
    ]),
    channelGuide: {
      title: '앱·홈페이지·우편 병행',
      detail: '앱/홈페이지 접수를 우선 보되 우편·방문·FAX 채널도 함께 염두에 둡니다.',
    },
    rules: {
      mobileLimit: 50000000,
      claimWindowYears: 3,
      outpatientDiagnosisThreshold: 30000,
      outpatientDetailThreshold: 100000,
      digitalClaimFormOptional: true,
      standardPayoutDays: 3,
      investigationDays: 30,
    },
    adminChecklist: [
      '앱 또는 홈페이지 접수 후 진행 상태를 확인할 수 있는지 점검합니다.',
      '최종 서류 접수일 기준 3영업일 지급 원칙, 조사 필요 시 최대 30영업일 안내 기준을 참고합니다.',
      '청구 사유 발생일로부터 3년 이내 접수 여부를 점검합니다.',
    ],
    officialNotes: [
      '동일 사고 기준 통원의료비가 크지 않은 경우 질병분류코드가 있는 처방전이 보완서류 역할을 할 수 있습니다.',
      '청구 금액이 작더라도 특정 진료과목이나 반복 청구는 추가심사가 붙을 수 있습니다.',
    ],
  },
  {
    id: 'db-insure',
    label: 'DB손해보험',
    aliases: ['db-insure', 'db', 'db손해보험', '동부화재'],
    basisLabel: 'DB손해보험 상해·질병 보험금청구 안내 기준',
    referenceDate: CLAIM_SOURCE_VERIFIED_DATE,
    source: defineOfficialSource([
      {
        label: '상해/질병 보험금청구',
        url: 'https://idbins.com/FMCLAV1039.do',
      },
      {
        label: '필요서류안내',
        url: 'https://www.idbins.com/mo/bizxpress/ct/dc/FMCUSV1216.shtm',
      },
      {
        label: '보험금 청구 유의사항',
        url: 'https://www.idbins.com/pc/bizxpress/ask/ia/FWCLAV1123.shtm',
      },
    ], [
      '모바일 청구 100만원 이하, 홈페이지 청구 500만원 이하 안내를 확인해 디지털 한도는 홈페이지 기준으로 잡았습니다.',
      '3만원 초과 통원의료비 진단명 포함 서류와 비급여 세부내역서 예외를 확인했습니다.',
    ]),
    channelGuide: {
      title: '홈페이지·모바일 앱 우선',
      detail: '회원은 홈페이지/모바일, 비회원은 이메일·FAX 보완 가능성을 함께 안내합니다.',
    },
    rules: {
      mobileLimit: 5000000,
      claimWindowYears: 3,
      outpatientDiagnosisThreshold: 30000,
      outpatientDetailThreshold: 100000,
      inpatientAltThreshold: 500000,
      digitalClaimFormOptional: true,
    },
    adminChecklist: [
      '회원 여부에 따라 홈페이지 대리청구 가능 여부가 달라질 수 있어 접수 채널을 먼저 점검합니다.',
      '비회원은 대표 이메일 또는 대표 FAX 접수 가능 여부를 확인합니다.',
      '청구 사유 발생일로부터 3년 이내 접수 여부를 점검합니다.',
    ],
    officialNotes: [
      '실손 통원 소액 청구에서는 영수증, 세부내역서, 질병분류코드가 있는 처방전 조합이 자주 요구됩니다.',
      '입원 청구는 금액이 작아도 진단명과 입원기간이 함께 보이는 서류가 있으면 보완 부담이 줄어듭니다.',
    ],
  },
  {
    id: 'meritz-fire',
    label: '메리츠화재',
    aliases: ['meritz-fire', 'meritz', '메리츠화재', '메리츠화재해상보험'],
    basisLabel: '메리츠화재 보험금 청구 서류 안내 기준',
    referenceDate: CLAIM_SOURCE_VERIFIED_DATE,
    source: defineOfficialSource([
      {
        label: '보상/보험금청구',
        url: 'https://www.meritzfire.com/compensation.do',
      },
      {
        label: '보험금청구서류 접수방법',
        url: 'https://cmdown.meritzfire.com/manager/cm/document/supply.pdf',
      },
      {
        label: '보험금청구서',
        url: 'https://cmdown.meritzfire.com/manager/cm/document/meritzfire_claim_form.pdf',
      },
    ], [
      'FAX, 홈페이지, 모바일앱 접수는 청구금액 100만원 이하 건 기준이라는 안내를 확인했습니다.',
      '개인정보 처리·의료심사 동의 거부 시 지급 지연 또는 불가 문구를 확인했습니다.',
    ]),
    channelGuide: {
      title: '홈페이지·모바일·FAX 병행',
      detail: '소액은 홈페이지/앱/FAX, 그 외에는 우편 원본 제출 가능성을 같이 봅니다.',
    },
    rules: {
      mobileLimit: 1000000,
      claimWindowYears: 3,
      outpatientDiagnosisThreshold: 30000,
      outpatientDetailThreshold: 100000,
      digitalClaimFormOptional: false,
    },
    adminChecklist: [
      'FAX·홈페이지·모바일앱 접수는 100만원 이하 건 위주로 보고, 그 외에는 우편 원본 제출을 함께 확인합니다.',
      '보험금 청구서와 개인정보 처리 동의 누락 여부를 먼저 점검합니다.',
      '청구 사유 발생일로부터 3년 이내 접수 여부를 점검합니다.',
    ],
    officialNotes: [
      '의료심사나 개인정보 처리 동의를 거부하면 지급이 지연되거나 불가할 수 있습니다.',
      '원본 제출이 필요한 서류인지 여부를 채널 선택 전에 먼저 확인하는 편이 안전합니다.',
    ],
  },
  {
    id: 'hyundai-marine',
    label: '현대해상',
    aliases: ['hyundai-marine', 'hyundai', 'hi', '현대해상', '현대해상화재보험'],
    basisLabel: '현대해상 보험금 청구 절차 안내 기준',
    referenceDate: CLAIM_SOURCE_VERIFIED_DATE,
    source: defineOfficialSource([
      {
        label: '보험금청구 필요서류',
        url: 'https://www.hi.co.kr/serviceAction.do?menuId=100631',
      },
      {
        label: '보험금청구서류 안내장',
        url: 'https://www.hi.co.kr/FileActionServlet/preview/1/data/202409/be11216a9ad3015a1614c313610d5200.pdf/%EB%B3%B4%ED%97%98%EA%B8%88%EC%B2%AD%EA%B5%AC%EC%84%9C%28%EA%B8%B0%EB%B3%B8%29_%EC%88%98%EC%A0%95%EB%B3%B8.pdf',
      },
    ], [
      '실손의료비 공통서류, 입원/통원 서류, 비급여 세부내역서 필수 문구를 확인했습니다.',
      '청구금액 1,000만원 초과 시 우편/방문 원본서류 필요 문구를 확인했습니다.',
    ]),
    channelGuide: {
      title: '홈페이지·모바일 앱·우편',
      detail: '홈페이지/앱 접수와 우편 접수를 같이 열어두고 담당자 지정 여부를 확인합니다.',
    },
    rules: {
      mobileLimit: 10000000,
      claimWindowYears: 3,
      outpatientDiagnosisThreshold: 30000,
      outpatientDetailThreshold: 100000,
      digitalClaimFormOptional: true,
      standardPayoutDays: 3,
    },
    adminChecklist: [
      '홈페이지, 모바일앱, 우편 접수 중 현재 청구 규모에 맞는 채널을 먼저 확인합니다.',
      '담당 손사 지정 후 연락처와 예상 지급기일이 문자로 오는지 확인합니다.',
      '청구 사유 발생일로부터 3년 이내 접수 여부를 점검합니다.',
    ],
    officialNotes: [
      '구비서류 접수 완료 후 3영업일 내 지급 원칙이지만 조사 필요 시 달라질 수 있습니다.',
      '분쟁이 생기면 금융감독원 분쟁조정까지 연결할 수 있다는 점을 사용자에게 명확히 보여줍니다.',
    ],
  },
];

export const CLAIM_PROFILE_OPTIONS = CLAIM_PROFILES.map((profile) => ({
  id: profile.id,
  label: profile.label,
  basisLabel: profile.basisLabel,
}));

export function createDefaultPolicyAssumptions() {
  return {
    coverageRate: 0.8,
    outpatientDeductible: 10000,
    prescriptionDeductible: 8000,
    inpatientDeductible: 0,
    annualLimit: 50000000,
    diagnosisBenefit: 0,
    surgeryBenefit: 0,
    alreadyPaid: 0,
  };
}

export function resolveClaimProfile(profileIdOrName) {
  const normalized = normalizeProfileKey(profileIdOrName);
  const matched =
    CLAIM_PROFILES.find((profile) => profile.id === normalized) ||
    CLAIM_PROFILES.find((profile) =>
      profile.aliases.some((alias) => normalizeProfileKey(alias) === normalized),
    ) ||
    CLAIM_PROFILES[0];

  return cloneProfile(matched);
}

export function buildDocumentRecord({ id, name, text, sourceType, previewUrl, pageCount }) {
  const normalizedText = normalizeText(text);
  const lines = splitLines(normalizedText);
  const classification = classifyDocument(normalizedText, name);
  const dates = extractDates(normalizedText);
  const organization = extractOrganization(lines);
  const patientName = extractPatientName(normalizedText);
  const amount = extractAmount(lines, normalizedText, classification.type);
  const flags = buildFlags(normalizedText);
  const visitType = detectVisitType(normalizedText, classification.type);
  const excerpt = buildExcerpt(lines);
  const warnings = buildWarnings({
    classification,
    organization,
    dates,
    amount,
    flags,
  });

  return {
    id,
    name,
    sourceType,
    previewUrl,
    pageCount,
    text,
    normalizedText,
    type: classification.type,
    typeLabel: DOCUMENT_TYPE_LABELS[classification.type] || DOCUMENT_TYPE_LABELS.other,
    confidence: classification.confidence,
    organization,
    patientName,
    dates,
    primaryDate: dates[0] || null,
    amount,
    visitType,
    flags,
    excerpt,
    warnings,
  };
}

export function analyzeClaimReadiness(
  rawDocuments,
  profileIdOrName,
  policyAssumptions = createDefaultPolicyAssumptions(),
) {
  const profile = resolveClaimProfile(profileIdOrName);
  const source = buildSourceSnapshot(profile.source);
  const assumptions = { ...createDefaultPolicyAssumptions(), ...policyAssumptions };
  const documents = rawDocuments.map((document) =>
    document.normalizedText ? document : buildDocumentRecord(document),
  );
  const summary = buildDocumentSummary(documents);
  const claimType = detectClaimType(summary);
  const claimTypeLabel = CLAIM_TYPE_LABELS[claimType];
  const estimate = buildEstimate(summary, claimType, assumptions, profile);
  const checklist = buildChecklist(summary, claimType, estimate, profile);
  const missingDocuments = checklist.filter((item) => !item.found).map((item) => item.label);
  const score = computeScore(summary, checklist, estimate);
  const decision = buildDecision(summary, checklist, estimate, score, profile);
  const status = score >= 80 ? '접수 가능권' : score >= 60 ? '보완 필요' : '핵심 서류 부족';
  const highlights = buildHighlights(summary, claimType, estimate, profile);
  const nextActions = buildNextActions(checklist, estimate, profile);
  const adminChecklist = buildAdminChecklist(summary, estimate, profile);
  const officialNotes = buildOfficialNotes(summary, estimate, profile);
  const disputeGuide = buildDisputeGuide(summary, checklist, estimate, profile);
  const summaryTitle =
    decision.verdict === 'likely'
      ? '지급 가능성이 비교적 높은 묶음입니다.'
      : decision.verdict === 'review'
        ? '추가심사를 염두에 둬야 하는 묶음입니다.'
        : '현재 상태만으로는 지급 판단이 어렵습니다.';
  const summaryText = buildSummaryText(summary, claimTypeLabel, estimate, missingDocuments);
  const notes = buildAnalysisNotes(summary, estimate, profile);
  const reportPreview = `${profile.label} 기준 ${claimTypeLabel} 청구로 분류했고, 현재 준비도 ${score}점입니다. ${missingDocuments.length ? `${missingDocuments.slice(0, 2).join(', ')} 보완이 우선입니다.` : '핵심 서류는 대체로 갖춰졌습니다.'}`;

  return {
    insurerName: profile.label,
    profileId: profile.id,
    profileLabel: profile.label,
    basisLabel: profile.basisLabel,
    referenceDate: profile.referenceDate,
    source,
    claimType,
    claimTypeLabel,
    channelGuide: buildChannelGuide(estimate, profile),
    policyAssumptions: assumptions,
    adminChecklist,
    officialNotes,
    decision,
    estimate,
    disputeGuide,
    score,
    status,
    summaryTitle,
    summaryText,
    checklist,
    missingDocuments,
    highlights,
    nextActions,
    notes,
    reportPreview,
  };
}

export function compareClaimProfiles(rawDocuments, policyAssumptions = createDefaultPolicyAssumptions()) {
  const documents = rawDocuments.map((document) =>
    document.normalizedText ? document : buildDocumentRecord(document),
  );
  const rankings = CLAIM_PROFILE_OPTIONS.map((profile) => {
    const analysis = analyzeClaimReadiness(documents, profile.id, policyAssumptions);
    const missingItems = analysis.checklist.filter((item) => !item.found);
    const mandatoryMissingItems = missingItems.filter((item) => item.mandatory);
    const blockerCount = analysis.estimate.blockers.length;
    const issueCount = analysis.disputeGuide.issues.length;
    const recommendationScore = computeRecommendationScore({
      score: analysis.score,
      verdict: analysis.decision.verdict,
      digitalEligible: analysis.estimate.digitalEligible,
      missingCount: missingItems.length,
      mandatoryMissingCount: mandatoryMissingItems.length,
      blockerCount,
      issueCount,
    });
    const reasons = buildComparisonReasons({
      analysis,
      missingItems,
      mandatoryMissingItems,
      blockerCount,
      issueCount,
    });

    return {
      profileId: analysis.profileId,
      profileLabel: analysis.profileLabel,
      basisLabel: analysis.basisLabel,
      referenceDate: analysis.referenceDate,
      source: analysis.source,
      sourceStatusLabel: analysis.source.statusLabel,
      sourceVerifiedDate: analysis.source.verifiedDate,
      sourceNextReviewDate: analysis.source.nextReviewDate,
      channelTitle: analysis.channelGuide.title,
      score: analysis.score,
      recommendationScore,
      status: analysis.status,
      decisionLabel: analysis.decision.label,
      decisionVerdict: analysis.decision.verdict,
      estimateRangeLabel: analysis.estimate.rangeLabel,
      digitalEligible: analysis.estimate.digitalEligible,
      missingCount: missingItems.length,
      mandatoryMissingCount: mandatoryMissingItems.length,
      blockerCount,
      issueCount,
      reasons,
      reasonSummary: reasons[0],
    };
  }).sort(
    (left, right) =>
      right.recommendationScore - left.recommendationScore ||
      right.score - left.score ||
      left.mandatoryMissingCount - right.mandatoryMissingCount,
  );
  const best = rankings[0] || null;

  return {
    best,
    rankings,
    summary: buildComparisonSummary(best, rankings),
    disclaimer:
      '이 비교는 보험상품 가입 추천이 아니라, 현재 업로드한 서류로 앱에 등록된 보험사 안내 기준을 대조한 참고용 청구 준비 비교입니다.',
  };
}

function computeRecommendationScore({
  score,
  verdict,
  digitalEligible,
  missingCount,
  mandatoryMissingCount,
  blockerCount,
  issueCount,
}) {
  const optionalMissingCount = Math.max(0, missingCount - mandatoryMissingCount);
  const verdictPenalty = verdict === 'likely' ? 0 : verdict === 'review' ? 6 : 14;
  const verdictBonus = verdict === 'likely' ? 4 : 0;
  const digitalAdjustment = digitalEligible ? 5 : -8;
  const riskPenalty =
    mandatoryMissingCount * 5 +
    optionalMissingCount * 2 +
    blockerCount * 2 +
    Math.min(issueCount * 1.5, 6) +
    verdictPenalty;

  return clamp(Math.round(score + verdictBonus + digitalAdjustment - riskPenalty), 0, 100);
}

function buildComparisonReasons({ analysis, missingItems, mandatoryMissingItems, blockerCount, issueCount }) {
  const reasons = [];

  if (mandatoryMissingItems.length) {
    reasons.push(`필수 보완 서류 ${mandatoryMissingItems.length}건이 있어 바로 접수하면 보완 요청 가능성이 있습니다.`);
  } else {
    reasons.push('필수 서류 누락이 없어 접수 준비 부담이 낮습니다.');
  }

  if (analysis.estimate.digitalEligible) {
    reasons.push('예상 청구 규모가 디지털 접수 가이드 범위 안에 있습니다.');
  } else {
    reasons.push('예상 청구 규모 때문에 우편, 방문, 원본 제출 확인이 필요할 수 있습니다.');
  }

  if (analysis.decision.verdict === 'likely') {
    reasons.push('현재 서류 조합 기준 지급 가능성 판정이 높게 잡혔습니다.');
  } else if (analysis.decision.verdict === 'review') {
    reasons.push('추가심사 가능성이 있어 접수 전 설명 자료를 보강하는 편이 안전합니다.');
  } else {
    reasons.push('현재 상태만으로는 지급 판단이 약해 핵심 서류 보강이 먼저입니다.');
  }

  if (blockerCount) {
    reasons.push(`예상 수령액 계산 제한 요인 ${blockerCount}건을 먼저 확인해야 합니다.`);
  } else {
    reasons.push('예상 수령액 계산을 막는 큰 제한 요인은 아직 보이지 않습니다.');
  }

  if (issueCount) {
    reasons.push(`분쟁 또는 추가심사 쟁점 ${issueCount}건을 염두에 둬야 합니다.`);
  }

  if (missingItems.length && !mandatoryMissingItems.length) {
    reasons.push(`선택 보완 서류 ${missingItems.length}건을 준비하면 안정성이 더 올라갑니다.`);
  }

  reasons.push(`${analysis.channelGuide.title} 접수 흐름을 기준으로 확인합니다.`);
  return reasons.slice(0, 5);
}

function buildComparisonSummary(best, rankings) {
  if (!best) {
    return '비교할 의료 서류가 아직 없습니다.';
  }

  const runnerUp = rankings[1];
  const gap = runnerUp ? best.recommendationScore - runnerUp.recommendationScore : 0;

  if (runnerUp && gap <= 3) {
    return `${best.profileLabel}: ${best.recommendationScore}점으로 가장 높지만, 다음 순위(${runnerUp.profileLabel})와 차이가 작아 최종 접수 전 누락 서류를 한 번 더 확인해야 합니다.`;
  }

  return `${best.profileLabel}: ${best.recommendationScore}점으로 가장 높습니다. 현재 업로드한 서류 기준으로 접수 준비 부담이 가장 낮아 보입니다.`;
}

export function createReportText(analysis, documents) {
  const lines = [
    '[ClaimReady Report]',
    `- 기준 보험사: ${analysis.profileLabel}`,
    `- 기준 안내: ${analysis.basisLabel}`,
    `- 기준일: ${analysis.referenceDate}`,
    `- 공식 출처 확인일: ${analysis.source.verifiedDate || '미확인'}`,
    `- 다음 출처 검토일: ${analysis.source.nextReviewDate || '미정'} (${analysis.source.statusLabel || '출처 미확인'})`,
    `- 공식 출처: ${
      analysis.source.sources.length
        ? analysis.source.sources.map((source) => `${source.label} ${source.url}`).join(' / ')
        : '미등록'
    }`,
    `- 청구 유형: ${analysis.claimTypeLabel}`,
    `- 준비도 점수: ${analysis.score}/100`,
    `- 판단: ${analysis.decision.label}`,
    `- 예상 수령액: ${analysis.estimate.rangeLabel}`,
    '',
    '[문서 요약]',
    ...documents.map(
      (document) =>
        `- ${document.name}: ${document.typeLabel}, ${document.organization || '기관명 미확인'}, ${document.primaryDate || '날짜 미확인'}, ${document.amount ? formatMoney(document.amount) : '금액 미확인'}`,
    ),
    '',
    '[핵심 부족 서류]',
    ...(analysis.missingDocuments.length
      ? analysis.missingDocuments.map((item) => `- ${item}`)
      : ['- 핵심 누락 서류 없음']),
    '',
    '[다음 행동]',
    ...analysis.nextActions.map((item) => `- ${item}`),
    '',
    '[분쟁 대응]',
    `- 요약: ${analysis.disputeGuide.summary}`,
    ...analysis.disputeGuide.steps.map((item) => `- ${item}`),
    '',
    '[주의]',
    '- 본 결과는 참고용 추정이며 실제 보험사 심사 결과를 확정하지 않습니다.',
  ];

  return lines.join('\n');
}

const CLAIM_TYPE_LABELS = {
  outpatient: '통원 청구',
  inpatient: '입원 청구',
  mixed: '입원·통원 혼합 청구',
  unknown: '청구 유형 미확정',
};

function defineOfficialSource(sources, notes = []) {
  return {
    verifiedDate: CLAIM_SOURCE_VERIFIED_DATE,
    nextReviewDate: formatIsoDate(addDays(parseIsoDate(CLAIM_SOURCE_VERIFIED_DATE), CLAIM_SOURCE_REVIEW_INTERVAL_DAYS)),
    reviewIntervalDays: CLAIM_SOURCE_REVIEW_INTERVAL_DAYS,
    sources,
    notes,
  };
}

function buildSourceSnapshot(source) {
  if (!source) {
    return {
      verifiedDate: '',
      nextReviewDate: '',
      reviewIntervalDays: 0,
      status: 'unknown',
      statusLabel: '출처 미확인',
      daysUntilReview: null,
      sources: [],
      notes: [],
    };
  }

  const nextReviewDate = parseIsoDate(source.nextReviewDate);
  const today = startOfUtcDate(new Date());
  const daysUntilReview = nextReviewDate
    ? Math.ceil((nextReviewDate.getTime() - today.getTime()) / MS_PER_DAY)
    : null;
  const status =
    daysUntilReview === null
      ? 'unknown'
      : daysUntilReview < 0
        ? 'stale'
        : daysUntilReview <= SOURCE_REVIEW_WARNING_DAYS
          ? 'due-soon'
          : 'fresh';

  return {
    verifiedDate: source.verifiedDate,
    nextReviewDate: source.nextReviewDate,
    reviewIntervalDays: source.reviewIntervalDays,
    status,
    statusLabel: {
      fresh: '최신 확인됨',
      'due-soon': '검토 예정 임박',
      stale: '재확인 필요',
      unknown: '출처 미확인',
    }[status],
    daysUntilReview,
    sources: (source.sources || []).map((item) => ({ ...item })),
    notes: [...(source.notes || [])],
  };
}

function cloneProfile(profile) {
  return {
    ...profile,
    aliases: [...profile.aliases],
    channelGuide: { ...profile.channelGuide },
    rules: { ...profile.rules },
    adminChecklist: [...profile.adminChecklist],
    officialNotes: [...profile.officialNotes],
    source: {
      ...profile.source,
      sources: (profile.source?.sources || []).map((item) => ({ ...item })),
      notes: [...(profile.source?.notes || [])],
    },
  };
}

function normalizeProfileKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9가-힣]/g, '');
}

function normalizeText(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function splitLines(text) {
  return normalizeText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function classifyDocument(text, name) {
  const source = `${name}\n${text}`;
  const scoreBoard = {
    hospitalReceipt: 0,
    claimDetail: 0,
    prescription: 0,
    pharmacyReceipt: 0,
    diagnosisStatement: 0,
    admissionCertificate: 0,
    claimForm: 0,
    insurerNotice: 0,
    other: 0.25,
  };

  applyScore(source, scoreBoard, 'hospitalReceipt', [
    /진료비.*영수증/,
    /계산서.?영수증/,
    /총납부금액/,
    /진료비.*계산/,
  ], 0.28);
  applyScore(source, scoreBoard, 'claimDetail', [
    /세부내역서/,
    /세부내역/,
    /비급여/,
    /급여/,
  ], 0.24);
  applyScore(source, scoreBoard, 'prescription', [
    /처방전/,
    /질병분류기호/,
    /상병코드/,
    /원외처방/,
  ], 0.26);
  applyScore(source, scoreBoard, 'pharmacyReceipt', [
    /약국/,
    /약제비/,
    /조제료/,
    /약품비/,
  ], 0.24);
  applyScore(source, scoreBoard, 'diagnosisStatement', [
    /진단서/,
    /진단명/,
    /진단일/,
  ], 0.26);
  applyScore(source, scoreBoard, 'admissionCertificate', [
    /입퇴원확인서/,
    /입원확인서/,
    /입원기간/,
    /퇴원일/,
  ], 0.26);
  applyScore(source, scoreBoard, 'claimForm', [
    /보험금청구서/,
    /청구서/,
    /수익자/,
    /계좌번호/,
    /개인정보/,
  ], 0.18);
  applyScore(source, scoreBoard, 'insurerNotice', [
    /추가서류/,
    /부지급/,
    /지급심사/,
    /감액/,
  ], 0.2);

  const [type, confidence] = Object.entries(scoreBoard).sort((left, right) => right[1] - left[1])[0];

  return {
    type,
    confidence: clamp(confidence, 0.2, 0.96),
  };
}

function applyScore(source, scoreBoard, type, patterns, increment) {
  patterns.forEach((pattern) => {
    if (pattern.test(source)) {
      scoreBoard[type] += increment;
    }
  });
}

function extractOrganization(lines) {
  const organizationPattern = /([가-힣A-Za-z0-9().\s]{2,40}(?:병원|의원|한의원|치과|요양병원|의료원|보건소|약국|센터))/;
  const candidate = lines.slice(0, 10).find((line) => organizationPattern.test(line)) || lines.find((line) => organizationPattern.test(line));
  return candidate?.match(organizationPattern)?.[1]?.trim() || null;
}

function extractPatientName(text) {
  const patterns = [
    /(?:환자명|성명|이름)\s*[:：]?\s*([가-힣]{2,5})/,
    /피보험자\s*[:：]?\s*([가-힣]{2,5})/,
  ];

  for (const pattern of patterns) {
    const matched = text.match(pattern);
    if (matched?.[1]) {
      return matched[1];
    }
  }

  return null;
}

function extractDates(text) {
  const matches = new Set();
  const patterns = [
    /(\d{4})[./-]\s*(\d{1,2})[./-]\s*(\d{1,2})/g,
    /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/g,
  ];

  for (const pattern of patterns) {
    for (const matched of text.matchAll(pattern)) {
      matches.add(
        `${matched[1]}-${String(Number(matched[2])).padStart(2, '0')}-${String(Number(matched[3])).padStart(2, '0')}`,
      );
    }
  }

  return [...matches].sort();
}

function extractAmount(lines, text, type) {
  if (!['hospitalReceipt', 'claimDetail', 'pharmacyReceipt'].includes(type)) {
    return null;
  }

  const totalLinePatterns = {
    hospitalReceipt: [/총납부/, /합계/, /계산서/, /영수증/, /총 진료비/, /결제금액/, /수납금액/],
    claimDetail: [/비급여/, /급여/, /세부내역/, /상세/, /합계/],
    pharmacyReceipt: [/약제비/, /조제료/, /영수증/, /결제금액/, /총액/, /합계/],
  };

  const candidates = lines
    .filter((line) => totalLinePatterns[type].some((pattern) => pattern.test(line)))
    .flatMap(extractMoneyValues);

  if (candidates.length) {
    return dedupeNumbers(candidates).sort((left, right) => right - left)[0];
  }

  const fallback = extractMoneyValues(text);
  return fallback.length ? dedupeNumbers(fallback).sort((left, right) => right - left)[0] : null;
}

function extractMoneyValues(text) {
  const values = [];

  for (const matched of String(text || '').matchAll(/(\d{1,3}(?:,\d{3})+|\d{2,})\s*원/g)) {
    values.push(Number(matched[1].replaceAll(',', '')));
  }

  return values.filter((value) => value >= 1000 && value <= 100000000);
}

function dedupeNumbers(values) {
  return values.filter((value, index, collection) => collection.indexOf(value) === index);
}

function detectVisitType(text, type) {
  if (type === 'admissionCertificate') {
    return 'inpatient';
  }

  if (/입원|입퇴원|퇴원/.test(text) && !/통원|외래/.test(text)) {
    return 'inpatient';
  }

  if (/통원|외래|원외처방|처방전|약국/.test(text)) {
    return 'outpatient';
  }

  return 'unknown';
}

function buildFlags(text) {
  return {
    hasDiagnosisCode: /질병분류기호|상병코드/.test(text),
    hasNonCovered: /비급여|도수치료|증식치료|체외충격파|MRI|초음파/.test(text),
    hasPrescription: /처방전|원외처방|복약|조제/.test(text),
    hasSurgery: /수술|시술/.test(text),
    hasAdmissionPeriod: /입원기간|입원일|퇴원일|입퇴원/.test(text),
    hasClaimFormData: /계좌번호|수익자|보험금청구서|청구인/.test(text),
  };
}

function buildExcerpt(lines) {
  return (lines.slice(0, 4).join(' / ') || '텍스트를 충분히 추출하지 못했습니다.').slice(0, 220);
}

function buildWarnings({ classification, organization, dates, amount, flags }) {
  const warnings = [];

  if (!organization) {
    warnings.push('기관명 확인 필요');
  }

  if (!dates.length) {
    warnings.push('진료일 확인 필요');
  }

  if (!amount && ['hospitalReceipt', 'claimDetail', 'pharmacyReceipt'].includes(classification.type)) {
    warnings.push('금액 확인 필요');
  }

  if (classification.type === 'prescription' && !flags.hasDiagnosisCode) {
    warnings.push('질병분류기호 확인 필요');
  }

  if (classification.type === 'hospitalReceipt' && flags.hasNonCovered) {
    warnings.push('비급여 확인용 세부내역서 권장');
  }

  return warnings;
}

function buildDocumentSummary(documents) {
  const documentsByType = Object.fromEntries(
    Object.keys(DOCUMENT_TYPE_LABELS).map((type) => [type, documents.filter((document) => document.type === type)]),
  );

  const visitBuckets = new Map();

  documents.forEach((document) => {
    if (!document.amount) {
      return;
    }

    const key = [document.organization || 'unknown', document.primaryDate || document.id, document.visitType].join('|');
    if (!visitBuckets.has(key)) {
      visitBuckets.set(key, {
        organization: document.organization,
        primaryDate: document.primaryDate,
        visitType: document.visitType,
        receiptAmount: null,
        detailAmount: null,
        pharmacyAmount: 0,
      });
    }

    const bucket = visitBuckets.get(key);

    if (document.type === 'hospitalReceipt') {
      bucket.receiptAmount = Math.max(bucket.receiptAmount || 0, document.amount);
    }

    if (document.type === 'claimDetail') {
      bucket.detailAmount = Math.max(bucket.detailAmount || 0, document.amount);
    }

    if (document.type === 'pharmacyReceipt') {
      bucket.pharmacyAmount += document.amount;
    }
  });

  const totals = {
    outpatientMedical: 0,
    inpatientMedical: 0,
    prescription: 0,
  };

  for (const bucket of visitBuckets.values()) {
    const hospitalAmount = bucket.receiptAmount ?? bucket.detailAmount ?? 0;
    if (bucket.visitType === 'inpatient') {
      totals.inpatientMedical += hospitalAmount;
    } else {
      totals.outpatientMedical += hospitalAmount;
    }
    totals.prescription += bucket.pharmacyAmount;
  }

  return {
    documents,
    documentsByType,
    visitBuckets: [...visitBuckets.values()],
    totals,
    hasDiagnosisCode: documents.some((document) => document.flags.hasDiagnosisCode),
    hasNonCovered: documents.some((document) => document.flags.hasNonCovered),
    hasPrescription: documents.some((document) => document.type === 'prescription' || document.flags.hasPrescription),
    hasSurgery: documents.some((document) => document.flags.hasSurgery),
    hasAdmission: documents.some(
      (document) => document.type === 'admissionCertificate' || document.flags.hasAdmissionPeriod,
    ),
    hasDiagnosisStatement: documents.some((document) => document.type === 'diagnosisStatement'),
    hasClaimForm: documents.some((document) => document.type === 'claimForm' || document.flags.hasClaimFormData),
  };
}

function detectClaimType(summary) {
  const inpatientSignals =
    summary.documentsByType.admissionCertificate.length +
    summary.documents.filter((document) => document.visitType === 'inpatient').length;
  const outpatientSignals =
    summary.documentsByType.prescription.length +
    summary.documentsByType.pharmacyReceipt.length +
    summary.documents.filter((document) => document.visitType === 'outpatient').length;

  if (inpatientSignals && outpatientSignals) {
    return 'mixed';
  }

  if (inpatientSignals) {
    return 'inpatient';
  }

  if (outpatientSignals || summary.documentsByType.hospitalReceipt.length || summary.documentsByType.claimDetail.length) {
    return 'outpatient';
  }

  return 'unknown';
}

function buildEstimate(summary, claimType, assumptions, profile) {
  const outpatientLoss = Math.max(
    0,
    summary.totals.outpatientMedical - assumptions.outpatientDeductible,
  );
  const inpatientLoss = Math.max(
    0,
    summary.totals.inpatientMedical - assumptions.inpatientDeductible,
  );
  const prescriptionLoss = Math.max(
    0,
    summary.totals.prescription - assumptions.prescriptionDeductible,
  );
  const coveredActualLoss = Math.max(
    0,
    Math.min(
      assumptions.annualLimit,
      Math.round((outpatientLoss + inpatientLoss + prescriptionLoss) * assumptions.coverageRate),
    ) - assumptions.alreadyPaid,
  );
  const fixedAmount =
    (summary.hasDiagnosisStatement || summary.hasDiagnosisCode ? assumptions.diagnosisBenefit : 0) +
    (summary.hasSurgery ? assumptions.surgeryBenefit : 0);
  const estimateBase = Math.max(0, coveredActualLoss + fixedAmount);
  const lowerRate =
    claimType === 'inpatient' ? 0.72 : summary.hasNonCovered ? 0.55 : 0.68;
  const upperRate = summary.hasNonCovered ? 0.92 : 1;
  const lowerBound = Math.max(0, Math.round(estimateBase * lowerRate));
  const upperBound = Math.max(lowerBound, Math.round(estimateBase * upperRate));
  const digitalEligible =
    typeof profile.rules.mobileLimit === 'number' ? upperBound <= profile.rules.mobileLimit : true;

  return {
    rangeLabel: upperBound
      ? `${formatMoney(lowerBound)} ~ ${formatMoney(upperBound)}`
      : '0원 ~ 추정 불가',
    lowerBound,
    upperBound,
    actualLossAmount: coveredActualLoss,
    actualLossLabel: formatMoney(coveredActualLoss),
    fixedAmount,
    fixedLabel: formatMoney(fixedAmount),
    assumptions: buildEstimateAssumptions(summary, claimType, assumptions, profile),
    blockers: buildEstimateBlockers(summary, claimType),
    methodNote:
      '약관 자동 추출값과 수동 보정값, 업로드한 서류 조합을 바탕으로 계산한 참고용 범위입니다.',
    digitalEligible,
    outpatientLoss,
    inpatientLoss,
    prescriptionLoss,
  };
}

function buildEstimateAssumptions(summary, claimType, assumptions, profile) {
  const items = [
    `보상비율 ${Math.round(assumptions.coverageRate * 100)}%`,
    `통원 공제 ${formatMoney(assumptions.outpatientDeductible)}, 약제 공제 ${formatMoney(assumptions.prescriptionDeductible)}`,
    `입원 공제 ${formatMoney(assumptions.inpatientDeductible)}, 연간 한도 ${formatMoney(assumptions.annualLimit)}`,
  ];

  if (summary.hasDiagnosisStatement || summary.hasDiagnosisCode) {
    items.push(`진단 관련 특약 추정 ${formatMoney(assumptions.diagnosisBenefit)} 반영`);
  }

  if (summary.hasSurgery) {
    items.push(`수술 관련 특약 추정 ${formatMoney(assumptions.surgeryBenefit)} 반영`);
  }

  if (typeof profile.rules.mobileLimit === 'number') {
    items.push(
      `${profile.label} 디지털 접수 가이드 기준 ${formatMoney(profile.rules.mobileLimit)} 이하 여부를 함께 점검`,
    );
  }

  items.push(`${CLAIM_TYPE_LABELS[claimType]} 기준으로 의료비 공제식을 적용`);
  return items;
}

function buildEstimateBlockers(summary, claimType) {
  const blockers = [];

  if (claimType !== 'unknown' && !summary.hasClaimForm) {
    blockers.push('보험금 청구서 또는 수익자/계좌 정보가 문서에서 확인되지 않습니다.');
  }

  if (claimType !== 'unknown' && !summary.documentsByType.hospitalReceipt.length) {
    blockers.push('기본 영수증이 없어 실제 본인부담금을 확정하기 어렵습니다.');
  }

  if (summary.hasNonCovered && !summary.documentsByType.claimDetail.length) {
    blockers.push('비급여가 보이는데 세부내역서가 없어 심사 포인트를 설명하기 어렵습니다.');
  }

  if (claimType !== 'inpatient' && summary.hasPrescription && !summary.documentsByType.pharmacyReceipt.length) {
    blockers.push('처방은 보이지만 약국 영수증이 없어 약제비 반영이 제한됩니다.');
  }

  if (claimType === 'inpatient' && !summary.hasAdmission) {
    blockers.push('입원기간을 증명할 서류가 부족합니다.');
  }

  if (!summary.hasDiagnosisCode && !summary.hasDiagnosisStatement) {
    blockers.push('진단명 또는 질병분류기호가 문서상 명확하지 않습니다.');
  }

  return blockers;
}

function buildChecklist(summary, claimType, estimate, profile) {
  const outpatientAmount = summary.totals.outpatientMedical + summary.totals.prescription;
  const diagnosisProofEnough =
    summary.hasDiagnosisStatement || summary.hasDiagnosisCode || outpatientAmount <= profile.rules.outpatientDiagnosisThreshold;
  const detailNeeded =
    summary.hasNonCovered ||
    summary.totals.outpatientMedical >= profile.rules.outpatientDetailThreshold ||
    summary.totals.inpatientMedical > 0;

  const checklist = [
    {
      label: '보험금 청구서',
      reason: estimate.digitalEligible && profile.rules.digitalClaimFormOptional
        ? '앱/홈페이지 작성으로 대체될 수 있지만, 수익자 정보 확인용 기본 문서입니다.'
        : '대부분의 보험사 접수에서 기본이 되는 서류입니다.',
      found: summary.hasClaimForm || (estimate.digitalEligible && profile.rules.digitalClaimFormOptional),
      mandatory: !estimate.digitalEligible || !profile.rules.digitalClaimFormOptional,
      action: '보험사 앱/홈페이지 또는 청구서 양식으로 청구인 정보와 계좌를 확정합니다.',
    },
    {
      label: '진료비 영수증',
      reason: '실제 본인부담금을 판단하는 기본 서류입니다.',
      found: summary.documentsByType.hospitalReceipt.length > 0,
      mandatory: true,
      action: '병원에서 진료비 계산서 영수증을 재발급받습니다.',
    },
    {
      label: '진단명 확인 서류',
      reason: '질병분류기호, 진단명, 진료일이 같이 보이면 심사 속도가 빨라집니다.',
      found: diagnosisProofEnough,
      mandatory: outpatientAmount > 0 || claimType === 'inpatient',
      action: '질병분류기호가 기재된 처방전 또는 진단서를 준비합니다.',
    },
    {
      label: '진료비 세부내역서',
      reason: detailNeeded
        ? '비급여나 고액 치료비가 보이면 세부내역서가 심사 핵심이 됩니다.'
        : '비급여가 없으면 생략 가능한 경우가 있지만 준비해 두면 안전합니다.',
      found: !detailNeeded || summary.documentsByType.claimDetail.length > 0,
      mandatory: detailNeeded,
      action: '비급여 항목이 보이는 경우 세부내역서를 우선 보강합니다.',
    },
  ];

  if (claimType === 'outpatient' || claimType === 'mixed') {
    checklist.push(
      {
        label: '처방전',
        reason: '통원 청구에서 질병분류기호와 처방 정보가 핵심 증빙이 됩니다.',
        found: !summary.hasPrescription || summary.documentsByType.prescription.length > 0,
        mandatory: summary.hasPrescription,
        action: '질병분류기호가 보이는 처방전을 준비합니다.',
      },
      {
        label: '약국 영수증',
        reason: '처방조제비 청구가 있으면 약제비 영수증이 별도 필요합니다.',
        found: !summary.hasPrescription || summary.documentsByType.pharmacyReceipt.length > 0,
        mandatory: summary.hasPrescription,
        action: '약국에서 약제비 계산서 영수증을 재발급받습니다.',
      },
    );
  }

  if (claimType === 'inpatient' || claimType === 'mixed') {
    checklist.push(
      {
        label: '입퇴원확인서',
        reason: '입원기간과 입퇴원 사실을 보여주는 핵심 서류입니다.',
        found: summary.hasAdmission,
        mandatory: true,
        action: '입원일과 퇴원일이 같이 보이는 입퇴원확인서를 준비합니다.',
      },
      {
        label: '진단서',
        reason: '입원 청구는 진단명과 입원 사유를 문서로 고정해 두는 편이 안전합니다.',
        found: summary.hasDiagnosisStatement || summary.hasDiagnosisCode,
        mandatory: true,
        action: '진단명과 상병코드가 함께 적힌 진단서를 보강합니다.',
      },
    );
  }

  return checklist;
}

function computeScore(summary, checklist, estimate) {
  let score = 96;

  checklist.forEach((item) => {
    if (!item.found) {
      score -= item.mandatory ? 16 : 9;
    }
  });

  if (summary.documents.some((document) => !document.organization)) {
    score -= 4;
  }

  if (summary.documents.some((document) => !document.primaryDate)) {
    score -= 4;
  }

  if (summary.hasNonCovered && !summary.documentsByType.claimDetail.length) {
    score -= 10;
  }

  if (!summary.hasDiagnosisCode && !summary.hasDiagnosisStatement) {
    score -= 10;
  }

  if (estimate.upperBound === 0) {
    score -= 6;
  }

  return clamp(Math.round(score), 18, 99);
}

function buildDecision(summary, checklist, estimate, score, profile) {
  const missingCritical = checklist.filter((item) => item.mandatory && !item.found);
  const reasons = [];
  const positives = [];

  if (missingCritical.length) {
    reasons.push(`핵심 누락 서류 ${missingCritical.length}건: ${missingCritical.map((item) => item.label).join(', ')}`);
  }

  if (summary.hasNonCovered) {
    reasons.push('비급여 항목이 보여 추가심사 가능성이 있습니다.');
  }

  if (!summary.hasDiagnosisCode && !summary.hasDiagnosisStatement) {
    reasons.push('진단명 또는 질병분류기호가 문서에서 명확하지 않습니다.');
  }

  if (estimate.upperBound > 0 && estimate.digitalEligible) {
    positives.push('예상 청구 규모가 디지털 접수 가이드 범위 안에 있습니다.');
  }

  if (summary.documentsByType.hospitalReceipt.length) {
    positives.push('기본 영수증이 있어 실제 부담액 추정이 가능합니다.');
  }

  if (summary.hasDiagnosisCode || summary.hasDiagnosisStatement) {
    positives.push('진단명 또는 상병코드 확인 서류가 있습니다.');
  }

  if (summary.hasAdmission) {
    positives.push('입원기간을 증명할 수 있는 서류가 있습니다.');
  }

  let verdict = 'review';
  let label = '추가심사 가능성 높음';
  let description = `${profile.label} 기준 안내로 보면 심사 단계에서 보완 요청이 붙을 가능성이 있습니다.`;

  if (score >= 80 && !missingCritical.length) {
    verdict = 'likely';
    label = '지급 가능성 높음';
    description = '핵심 서류 조합이 비교적 안정적이라 접수 후 바로 심사로 넘어갈 가능성이 높습니다.';
  } else if (score < 55 || missingCritical.length >= 2) {
    verdict = 'low';
    label = '현재 상태로는 지급 판단 어려움';
    description = '핵심 서류가 빠져 있거나 진단 근거가 약해서 바로 접수하면 보완 요청이 붙을 가능성이 큽니다.';
  }

  if (!reasons.length) {
    reasons.push('업로드한 서류만 놓고 보면 즉시 배척할 큰 결함은 아직 보이지 않습니다.');
  }

  if (!positives.length) {
    positives.push('문서 업로드는 완료되었지만 지급 판단에 충분한 확정 신호는 아직 적습니다.');
  }

  return {
    verdict,
    label,
    description,
    reasons,
    positives,
  };
}

function buildHighlights(summary, claimType, estimate, profile) {
  const items = [
    `${summary.documents.length}개 문서를 ${CLAIM_TYPE_LABELS[claimType]} 기준으로 묶었습니다.`,
    `영수증/세부내역/약국 영수증 기준 의료비 추정 합계는 ${formatMoney(summary.totals.outpatientMedical + summary.totals.inpatientMedical + summary.totals.prescription)}입니다.`,
    `${profile.label} 프로필 기준 예상 수령 범위는 ${estimate.rangeLabel}입니다.`,
  ];

  if (summary.hasNonCovered) {
    items.push('비급여 항목이 보여 세부내역서와 치료 필요성 설명이 중요합니다.');
  }

  if (claimType === 'mixed') {
    items.push('입원과 통원 증빙이 섞여 있어 제출 순서를 정리한 뒤 접수하는 편이 안전합니다.');
  }

  return items;
}

function buildNextActions(checklist, estimate, profile) {
  const missingMandatory = checklist.filter((item) => item.mandatory && !item.found);
  const actions = [];

  missingMandatory.forEach((item) => {
    actions.push(item.action);
  });

  if (!estimate.digitalEligible && typeof profile.rules.mobileLimit === 'number') {
    actions.push(`예상 청구금액이 ${formatMoney(profile.rules.mobileLimit)}를 넘을 수 있어 우편·원본 제출 가능성을 같이 확인합니다.`);
  } else {
    actions.push('앱/홈페이지 접수 가능 여부를 먼저 확인하고, 같은 화면에서 누락 서류를 끝까지 채웁니다.');
  }

  actions.push('보험사에서 보완 요청이 오면 요청 문구와 약관 조항을 서면으로 다시 받아 둡니다.');

  return dedupeText(actions);
}

function buildAdminChecklist(summary, estimate, profile) {
  const items = [...profile.adminChecklist];

  if (estimate.digitalEligible) {
    items.push('현재 추정 금액 기준으로는 디지털 접수 우선 검토가 가능합니다.');
  } else if (typeof profile.rules.mobileLimit === 'number') {
    items.push(`현재 추정 금액은 ${formatMoney(profile.rules.mobileLimit)} 초과 가능성이 있어 원본 제출 준비가 필요합니다.`);
  }

  if (summary.hasPrescription && !summary.documentsByType.pharmacyReceipt.length) {
    items.push('약제비 청구가 섞여 있으면 약국 영수증을 누락하지 않았는지 다시 확인합니다.');
  }

  items.push('수익자와 계좌 명의가 일치하는지 확인합니다.');
  return dedupeText(items);
}

function buildOfficialNotes(summary, estimate, profile) {
  const notes = [...profile.officialNotes];

  if (summary.hasNonCovered) {
    notes.push('비급여 항목은 영수증만으로 설명이 부족할 수 있어 세부내역서와 검사결과를 같이 보는 편이 안전합니다.');
  }

  if (estimate.actualLossAmount === 0) {
    notes.push('현재 입력값으로는 공제 후 실손 지급 추정액이 0원이라 약관/자기부담금 확인이 더 필요합니다.');
  }

  return dedupeText(notes);
}

function buildDisputeGuide(summary, checklist, estimate, profile) {
  const issues = [];
  const evidencePack = [];
  const steps = [
    '보험사에 부지급·감액 사유와 적용 약관 조항을 서면으로 요청합니다.',
    '보완 요청이 오면 요청한 문구와 현재 가진 서류를 1:1로 매칭해 누락 여부를 다시 확인합니다.',
    '같은 쟁점이 반복되면 1372 상담, 한국소비자원 피해구제, 금융감독원 분쟁조정 순으로 escalate 합니다.',
  ];

  checklist
    .filter((item) => !item.found)
    .forEach((item) => {
      issues.push(`${item.label} 부족`);
      evidencePack.push(item.action);
    });

  if (summary.hasNonCovered) {
    issues.push('비급여 필요성 입증');
    evidencePack.push('세부내역서, 검사결과, 치료 필요성 소견서 또는 차트 메모');
  }

  if (!summary.hasDiagnosisCode && !summary.hasDiagnosisStatement) {
    issues.push('진단명 또는 상병코드 부족');
    evidencePack.push('질병분류기호가 기재된 처방전 또는 진단서');
  }

  if (summary.hasAdmission && !summary.documentsByType.admissionCertificate.length) {
    issues.push('입원기간 증빙 보강');
    evidencePack.push('입원일과 퇴원일이 함께 보이는 입퇴원확인서');
  }

  if (!steps.some((step) => step.includes('금융감독원')) && profile.id === 'hyundai-marine') {
    steps.push('현대해상 분쟁 문구와 함께 금융감독원 1332 연결 여부를 안내합니다.');
  }

  const summaryText = issues.length
    ? `${profile.label}가 꼬투리를 잡기 쉬운 지점은 ${issues.slice(0, 2).join(', ')}입니다. 회신 문구와 약관 조항을 반드시 서면으로 남겨 두는 편이 안전합니다.`
    : `${profile.label} 기준으로는 서류 조합이 비교적 안정적이지만, 감액·보완 요청이 오면 근거 약관과 서면 회신을 먼저 확보해야 합니다.`;

  return {
    summary: summaryText,
    issues: dedupeText(issues),
    evidencePack: dedupeText(evidencePack),
    steps: dedupeText(steps),
    messageTemplate: [
      `${profile.label} 보상담당자님께,`,
      '',
      '현재 안내받은 보완/감액/부지급 사유와 적용 약관 조항을 서면으로 요청드립니다.',
      '또한 추가로 필요한 서류가 있다면 서류명, 필요 사유, 대체 가능 서류 여부를 구체적으로 안내 부탁드립니다.',
      '',
      '제가 보유한 서류는 다음과 같습니다.',
      `- 영수증/세부내역/진단 관련 문서 ${summary.documents.length}건`,
      `- 현재 ClaimReady 추정 준비도 ${estimate.rangeLabel}`,
      '',
      '가능하시다면 재심사 또는 보완 접수 기준도 함께 부탁드립니다.',
      '감사합니다.',
    ].join('\n'),
  };
}

function buildSummaryText(summary, claimTypeLabel, estimate, missingDocuments) {
  if (!summary.documents.length) {
    return '업로드한 서류가 없어 분석할 수 없습니다.';
  }

  return `${claimTypeLabel}로 분류했고, 현재 기준 예상 수령 범위는 ${estimate.rangeLabel}입니다. ${missingDocuments.length ? `우선 보강할 문서는 ${missingDocuments.slice(0, 2).join(', ')}입니다.` : '핵심 서류는 대체로 갖춰져 있습니다.'}`;
}

function buildAnalysisNotes(summary, estimate, profile) {
  const notes = [
    '보험사 실제 심사에서는 약관 세부 조항, 사고 경위, 과거 청구 이력에 따라 결과가 달라질 수 있습니다.',
    '이 결과는 서류 준비와 보완 방향을 잡기 위한 참고용 추정입니다.',
  ];

  if (typeof profile.rules.standardPayoutDays === 'number') {
    notes.push(
      `${profile.label} 안내 기준상 통상 서류 접수 후 ${profile.rules.standardPayoutDays}영업일 지급 원칙이 있으나 조사 필요 시 지연될 수 있습니다.`,
    );
  }

  if (estimate.upperBound === 0) {
    notes.push('현재 공제식 기준으로는 지급 추정액이 0원이라 자기부담금 또는 상품 구조 확인이 먼저 필요합니다.');
  }

  if (summary.hasNonCovered) {
    notes.push('비급여, 도수치료, MRI 같은 항목은 서류가 있어도 추가심사 가능성이 높습니다.');
  }

  return dedupeText(notes);
}

function buildChannelGuide(estimate, profile) {
  if (estimate.digitalEligible) {
    return { ...profile.channelGuide };
  }

  return {
    title: '원본·우편 채널 점검',
    detail:
      typeof profile.rules.mobileLimit === 'number'
        ? `${profile.label} 디지털 가이드 한도 ${formatMoney(profile.rules.mobileLimit)} 초과 가능성이 있어 우편 또는 원본 제출 채널을 같이 준비합니다.`
        : `${profile.label} 채널 가이드를 보면 원본 제출 가능성을 함께 점검하는 편이 안전합니다.`,
  };
}

function formatMoney(value) {
  return `${currencyFormatter.format(Math.max(0, Math.round(value || 0)))}원`;
}

function parseIsoDate(value) {
  const [year, month, day] = String(value || '')
    .split('-')
    .map((part) => Number.parseInt(part, 10));

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date, days) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function formatIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

function startOfUtcDate(date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function dedupeText(items) {
  return items.filter(Boolean).filter((item, index, collection) => collection.indexOf(item) === index);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
