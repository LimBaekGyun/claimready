const INSURER_PATTERNS = [
  { name: '삼성화재', pattern: /삼성화재|삼성화재해상보험/ },
  { name: 'DB손해보험', pattern: /DB손해보험|동부화재/ },
  { name: 'KB손해보험', pattern: /KB손해보험|LIG손해보험/ },
  { name: '메리츠화재', pattern: /메리츠화재|메리츠화재해상보험/ },
  { name: '현대해상', pattern: /현대해상|하이카|HiCAR|HiLife/ },
];

const OFFICIAL_RESPONSE_PATTERNS = [
  {
    id: 'receipt',
    issue: '접수 완료 또는 심사 대기',
    severity: 'received',
    patterns: [/접수완료|접수 완료|서류 접수 완료|청구 접수 완료|접수되었습니다/, /지급심사|심사 진행|심사중|심사 예정/],
    evidence: '접수일, 담당자, 접수번호가 보이는 안내문',
    action: '접수일과 담당자를 저장하고 추가 요청이 오면 바로 연결해서 대응하세요.',
    sourceHint: 'KB손해보험/현대해상 공식 청구 안내 문구',
  },
  {
    id: 'additional-docs',
    issue: '추가 또는 대체 서류 요청',
    severity: 'request',
    patterns: [
      /추가\s*\/?\s*대체\s*서류/,
      /추가서류/,
      /추가 요청서류/,
      /추가 제출/,
      /보완서류/,
      /보완 요청/,
      /별도의 추가 증빙서류 제출/,
      /추가 증빙서류/,
    ],
    evidence: '보험사가 지정한 추가/대체 서류 목록, 요청 사유, 담당자 안내문',
    action: '요청 서류를 그대로 준비하기 전에 왜 필요한지와 대체 가능 서류가 있는지 같이 확인하세요.',
    sourceHint: '삼성화재/메리츠화재/KB손해보험/DB손해보험 공식 서류 안내장',
  },
  {
    id: 'denial',
    issue: '부지급 또는 면책 주장',
    severity: 'denial',
    patterns: [
      /부지급/,
      /지급불가/,
      /불승인/,
      /보상책임 없음/,
      /면책/,
      /보험금 지급 사유에 해당하지/,
      /보험금 지급이 어렵/,
    ],
    evidence: '부지급 통보서 원문, 근거 약관 조항, 계약일/사고일 비교자료',
    action: '부지급 사유와 적용 약관 조항을 문서로 다시 받아두고, 반박할 수 있는 서류를 그 기준에 맞춰 준비하세요.',
    sourceHint: '보험사 부지급 안내 및 약관 면책 통지 문구',
  },
  {
    id: 'partial-payment',
    issue: '감액 또는 일부 지급',
    severity: 'partial',
    patterns: [/감액/, /일부 지급/, /일부지급/, /삭감/, /공제 후 지급/, /기지급/],
    evidence: '지급명세, 자기부담금 산정표, 계산 근거가 적힌 안내문',
    action: '감액이 자기부담금인지 보장 제외인지 먼저 구분해서 계산 근거를 다시 받아보세요.',
    sourceHint: '보험금 지급 결과 통지 문구',
  },
  {
    id: 'review',
    issue: '지급심사 또는 손해사정',
    severity: 'review',
    patterns: [/지급심사/, /손해사정/, /손해사정서/, /손해사정인/, /심사담당/, /처리결과 조회/, /지급심사 진행과정/],
    evidence: '심사 단계 안내, 접수일, 처리 예상 기한, 담당자 연락처',
    action: '심사 단계가 길어지면 접수일 기준 처리 기한과 현재 부족한 항목을 다시 문의하세요.',
    sourceHint: 'KB손해보험/현대해상 공식 지급심사 안내 문구',
  },
  {
    id: 'medical-advisory',
    issue: '의료자문 또는 전문 심사',
    severity: 'review',
    patterns: [/의료자문/, /자문의/, /전문의 판단/, /심사자문/],
    evidence: '검사결과지, 의사 소견서, 시술 필요성 근거, 자문 범위 안내문',
    action: '의료자문 사유와 자문 범위를 확인하고, 검사 결과와 진료기록 위주로 반박 자료를 준비하세요.',
    sourceHint: '보험금 지급심사·의료자문 관련 안내 문구',
  },
  {
    id: 'diagnosis-code',
    issue: '진단명 또는 질병분류코드 부족',
    severity: 'request',
    patterns: [
      /진단명/,
      /질병분류코드/,
      /질병분류기호/,
      /한국표준질병사인분류번호/,
      /상병코드/,
      /처방전/,
      /진단서/,
    ],
    evidence: '질병분류코드가 기재된 진단서, 처방전, 통원확인서',
    action: '질병분류코드가 보이는 문서를 우선 확보하고, 진단명과 날짜가 한 장에 같이 나오게 준비하세요.',
    sourceHint: '삼성화재/메리츠화재 공식 진단 관련 서류 문구',
  },
  {
    id: 'visit-period',
    issue: '통원기간 또는 입원기간 확인 필요',
    severity: 'request',
    patterns: [
      /통원기간/,
      /입원기간/,
      /통원 확인서/,
      /입퇴원 확인서/,
      /소견서/,
      /진료차트/,
      /의무기록/,
      /초진차트/,
      /초진진료기록지/,
    ],
    evidence: '통원기간/입원기간이 포함된 확인서, 소견서, 진료차트, 초진기록지',
    action: '기간 정보와 진단명이 동시에 보이는 문서를 준비하면 보완 요청을 줄일 수 있습니다.',
    sourceHint: '삼성화재/DB손해보험/메리츠화재 공식 필요서류 문구',
  },
  {
    id: 'non-covered',
    issue: '비급여 또는 세부내역서 쟁점',
    severity: 'request',
    patterns: [
      /비급여/,
      /진료비세부내역서/,
      /세부내역서/,
      /도수치료/,
      /주사치료/,
      /MRI/,
      /초음파/,
      /보장제외 대상이 많은 진료과목/,
    ],
    evidence: '진료비세부내역서, 검사결과, 치료 필요성 소견서',
    action: '비급여 항목은 영수증만 내지 말고 세부내역서와 치료 필요성 근거를 같이 붙이세요.',
    sourceHint: '삼성화재/KB손해보험/DB손해보험 공식 실손 안내 문구',
  },
  {
    id: 'accident-proof',
    issue: '사고 입증 서류 필요',
    severity: 'request',
    patterns: [
      /사고입증서류/,
      /사고사실확인서/,
      /교통사고사실확인/,
      /육하원칙/,
      /사고 경위서/,
      /상해사고 증명서류/,
      /초진차트 등 상해사고 증명서류/,
    ],
    evidence: '경찰서/소방서 사고확인서, 사고 경위서, 초진기록지',
    action: '상해 청구는 의료서류와 별도로 사고 경위 및 공공기관 확인서를 같이 준비하세요.',
    sourceHint: '삼성화재/DB손해보험/메리츠화재/현대해상 공식 사고입증 문구',
  },
  {
    id: 'family-delegation',
    issue: '가족관계 또는 위임 서류 필요',
    severity: 'request',
    patterns: [
      /가족관계확인서류/,
      /가족관계증명서/,
      /보험금 위임서류/,
      /위임장/,
      /인감증명서/,
      /본인서명사실확인서/,
      /상속관계/,
    ],
    evidence: '가족관계증명서, 위임장, 인감증명서 또는 본인서명사실확인서',
    action: '청구인, 피보험자, 수익자가 다르면 가족관계/위임 서류를 먼저 맞추세요.',
    sourceHint: '삼성화재/메리츠화재 공식 추가 요청서류 문구',
  },
];

const SEVERITY_RANK = {
  denial: 5,
  partial: 4,
  request: 3,
  review: 2,
  received: 1,
  unknown: 0,
};

function splitLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function findMatchingLines(lines, patterns, limit = 3) {
  return lines.filter((line) => patterns.some((pattern) => pattern.test(line))).slice(0, limit);
}

function detectInsurerName(text) {
  return INSURER_PATTERNS.find((entry) => entry.pattern.test(text))?.name || null;
}

export function extractInsurerResponseInsights(documents) {
  const lines = documents.flatMap((document) => splitLines(document.text));
  const joinedText = lines.join(' ');
  const insurerName = detectInsurerName(joinedText);
  const issueTypes = [];
  const evidencePack = [];
  const actions = [];
  const highlights = [];
  const matchedLines = [];
  const sourceHints = [];
  let severity = 'unknown';

  const promoteSeverity = (nextSeverity) => {
    if (SEVERITY_RANK[nextSeverity] > SEVERITY_RANK[severity]) {
      severity = nextSeverity;
    }
  };

  for (const patternGroup of OFFICIAL_RESPONSE_PATTERNS) {
    const hitLines = findMatchingLines(lines, patternGroup.patterns);
    if (!hitLines.length) {
      continue;
    }

    promoteSeverity(patternGroup.severity);

    if (!issueTypes.includes(patternGroup.issue)) {
      issueTypes.push(patternGroup.issue);
    }

    if (patternGroup.evidence && !evidencePack.includes(patternGroup.evidence)) {
      evidencePack.push(patternGroup.evidence);
    }

    if (patternGroup.action && !actions.includes(patternGroup.action)) {
      actions.push(patternGroup.action);
    }

    if (patternGroup.sourceHint && !sourceHints.includes(patternGroup.sourceHint)) {
      sourceHints.push(patternGroup.sourceHint);
    }

    for (const line of hitLines) {
      if (!matchedLines.includes(line)) {
        matchedLines.push(line);
      }
    }
  }

  if (!issueTypes.length) {
    highlights.push('보험사 회신서에서 뚜렷한 공식 문구 패턴은 아직 적게 잡혔습니다.');
    actions.push('회신서 원문에 적힌 보완 사유나 부지급 사유를 다시 업로드하거나 직접 확인해 주세요.');
  } else {
    if (insurerName) {
      highlights.push(`${insurerName} 회신 문구 패턴을 기준으로 쟁점을 정리했습니다.`);
    }
    highlights.push(`회신 문서에서 ${issueTypes.length}개의 쟁점을 포착했습니다.`);
    if (matchedLines.length) {
      highlights.push(`포착된 문구 예시: ${matchedLines.slice(0, 2).join(' / ')}`);
    }
  }

  if (!actions.includes('해결이 안 되면 1372 상담 후 한국소비자원 피해구제 또는 분쟁조정을 검토하세요.')) {
    actions.push('해결이 안 되면 1372 상담 후 한국소비자원 피해구제 또는 분쟁조정을 검토하세요.');
  }

  const summaryMap = {
    denial: '보험사가 이미 부지급 또는 면책 방향으로 판단한 흔적이 있어, 사유와 약관 근거를 먼저 고정하는 대응이 필요합니다.',
    partial: '감액 또는 일부 지급 문구가 있어, 실제 공제 기준과 계산 근거를 다시 받아보는 게 우선입니다.',
    request: '공식 안내장에서 쓰는 추가/대체 서류 요청 패턴이 보여, 요청 사유와 대체 가능 서류를 같이 확인해야 합니다.',
    review: '지급심사나 손해사정 단계 문구가 보여, 접수일과 심사 상태를 기준으로 대응해야 합니다.',
    received: '접수 완료 또는 심사 진행 초기 단계로 보이며, 지금은 접수일과 담당자 정보를 확보해 두는 것이 좋습니다.',
    unknown: '회신 문서만으로는 유형이 명확하지 않지만, 근거 약관과 부족 서류를 서면으로 받아두는 것이 안전합니다.',
  };

  return {
    insurerName,
    severity,
    summary: summaryMap[severity],
    issueTypes,
    evidencePack,
    actions,
    highlights,
    matchedLines,
    sourceHints,
  };
}
