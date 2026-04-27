const INSURER_PATTERNS = [
  { name: '삼성화재', pattern: /삼성화재|삼성화재해상보험/ },
  { name: '현대해상', pattern: /현대해상/ },
  { name: 'DB손해보험', pattern: /DB손해보험|동부화재/ },
  { name: 'KB손해보험', pattern: /KB손해보험|LIG손해보험/ },
  { name: '메리츠화재', pattern: /메리츠화재/ },
];

export function extractPolicyInsights(documents, defaultPolicyAssumptions) {
  const lines = documents.flatMap((document) => splitLines(document.text));
  const joinedText = lines.join(' ');
  const detectedAssumptions = {};
  const detectedFields = [];
  const notes = [];

  const insurerName = detectInsurerName(joinedText);
  const productName = detectProductName(lines);

  const coverageRate = detectCoverageRate(lines);
  if (coverageRate !== null) {
    detectedAssumptions.coverageRate = coverageRate.value;
    detectedFields.push(coverageRate.field);
  }

  const outpatientDeductible = detectMoneyField(lines, {
    key: 'outpatientDeductible',
    label: '통원 공제',
    linePatterns: [/통원/, /외래/],
    matchMode: 'any',
    valuePatterns: [/(?:공제|자기부담|공제금액|최소부담)[^0-9]{0,12}(.+)/],
  });
  if (outpatientDeductible) {
    detectedAssumptions.outpatientDeductible = outpatientDeductible.value;
    detectedFields.push(outpatientDeductible.field);
  }

  const prescriptionDeductible = detectMoneyField(lines, {
    key: 'prescriptionDeductible',
    label: '처방 조제 공제',
    linePatterns: [/처방/, /조제/, /약제/],
    matchMode: 'any',
    valuePatterns: [/(?:공제|자기부담|공제금액|최소부담)[^0-9]{0,12}(.+)/],
  });
  if (prescriptionDeductible) {
    detectedAssumptions.prescriptionDeductible = prescriptionDeductible.value;
    detectedFields.push(prescriptionDeductible.field);
  }

  const inpatientDeductible = detectMoneyField(lines, {
    key: 'inpatientDeductible',
    label: '입원 공제',
    linePatterns: [/입원/],
    matchMode: 'any',
    valuePatterns: [/(?:공제|자기부담|공제금액|최소부담)[^0-9]{0,12}(.+)/],
  });
  if (inpatientDeductible) {
    detectedAssumptions.inpatientDeductible = inpatientDeductible.value;
    detectedFields.push(inpatientDeductible.field);
  }

  const annualLimit = detectMoneyField(lines, {
    key: 'annualLimit',
    label: '연간 한도',
    linePatterns: [/연간/, /보상한도|한도|가입금액/],
    matchMode: 'all',
    valuePatterns: [/(?:한도|가입금액|보상한도)[^0-9]{0,12}(.+)/],
    pickLargest: true,
  });
  if (annualLimit) {
    detectedAssumptions.annualLimit = annualLimit.value;
    detectedFields.push(annualLimit.field);
  }

  const diagnosisBenefit = detectBenefitField(lines, {
    label: '진단비 특약',
    keywords: [/진단비/, /보험금|가입금액/],
  });
  if (diagnosisBenefit) {
    detectedAssumptions.diagnosisBenefit = diagnosisBenefit.value;
    detectedFields.push(diagnosisBenefit.field);
  }

  const surgeryBenefit = detectBenefitField(lines, {
    label: '수술비 특약',
    keywords: [/수술비/, /보험금|가입금액/],
  });
  if (surgeryBenefit) {
    detectedAssumptions.surgeryBenefit = surgeryBenefit.value;
    detectedFields.push(surgeryBenefit.field);
  }

  if (!detectedFields.length) {
    notes.push('약관에서 숫자 조건을 명확히 찾지 못했습니다. 입력칸에서 수동 보정이 필요합니다.');
  } else {
    notes.push(`약관에서 ${detectedFields.length}개 조건을 자동 추출했습니다.`);
  }

  if (!insurerName) {
    notes.push('보험사 이름을 확정하지 못했습니다.');
  }

  if (!productName) {
    notes.push('상품명은 명확히 잡히지 않아 일반 실손/특약 키워드 기준으로 읽었습니다.');
  }

  if (detectedAssumptions.annualLimit === undefined && defaultPolicyAssumptions.annualLimit) {
    notes.push(`연간 한도는 기본값 ${formatMoney(defaultPolicyAssumptions.annualLimit)}을 유지합니다.`);
  }

  return {
    insurerName,
    productName,
    detectedAssumptions,
    detectedFields,
    notes,
  };
}

export function formatMoney(value) {
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

function splitLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function detectInsurerName(text) {
  const matched = INSURER_PATTERNS.find((entry) => entry.pattern.test(text));
  return matched?.name || null;
}

function detectProductName(lines) {
  const labeledLine = lines.find((line) => /상품명|보험명|계약명|플랜명/.test(line));
  if (labeledLine) {
    const matched = labeledLine.match(/(?:상품명|보험명|계약명|플랜명)\s*[:：]?\s*(.+)$/);
    if (matched?.[1]) {
      return matched[1].trim().slice(0, 60);
    }
  }

  const candidate = lines.find((line) => /실손|실비|종합보험|특별약관|특약/.test(line) && line.length <= 80);
  return candidate || null;
}

function detectCoverageRate(lines) {
  for (const line of lines) {
    if (!/보상비율|보장비율|실손의료비|본인부담상당액/.test(line)) {
      continue;
    }

    const match = line.match(/([789]0)\s*%/);
    if (!match) {
      continue;
    }

    const numeric = Number(match[1]);
    return {
      value: numeric / 100,
      field: {
        key: 'coverageRate',
        label: '보상비율',
        displayValue: `${numeric}%`,
        source: line.slice(0, 80),
      },
    };
  }

  return null;
}

function detectMoneyField(lines, config) {
  const candidates = [];
  const matcher =
    config.matchMode === 'all'
      ? (line) => config.linePatterns.every((pattern) => pattern.test(line))
      : (line) => config.linePatterns.some((pattern) => pattern.test(line));

  for (const line of lines) {
    if (!matcher(line)) {
      continue;
    }

    const matchSource = config.valuePatterns
      .map((pattern) => line.match(pattern))
      .find(Boolean)?.[1] || line;

    const moneyValues = extractMoneyValues(matchSource);
    for (const money of moneyValues) {
      candidates.push({
        value: money,
        line,
      });
    }
  }

  if (!candidates.length) {
    return null;
  }

  const selected = config.pickLargest
    ? candidates.sort((left, right) => right.value - left.value)[0]
    : candidates[0];

  return {
    value: selected.value,
    field: {
      key: config.key,
      label: config.label,
      displayValue: formatMoney(selected.value),
      source: selected.line.slice(0, 80),
    },
  };
}

function detectBenefitField(lines, config) {
  for (const line of lines) {
    if (!config.keywords.every((pattern) => pattern.test(line))) {
      continue;
    }

    const values = extractMoneyValues(line).filter((value) => value >= 10000);
    if (!values.length) {
      continue;
    }

    const value = values.sort((left, right) => right - left)[0];
    return {
      value,
      field: {
        key: config.label,
        label: config.label,
        displayValue: formatMoney(value),
        source: line.slice(0, 80),
      },
    };
  }

  return null;
}

function extractMoneyValues(text) {
  const values = [];

  for (const match of text.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)\s*만\s*원/g)) {
    values.push(Number(match[1].replaceAll(',', '')) * 10000);
  }

  for (const match of text.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)\s*천\s*원/g)) {
    values.push(Number(match[1].replaceAll(',', '')) * 1000);
  }

  for (const match of text.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)\s*원/g)) {
    values.push(Number(match[1].replaceAll(',', '')));
  }

  return values.filter((value, index, collection) => collection.indexOf(value) === index);
}
