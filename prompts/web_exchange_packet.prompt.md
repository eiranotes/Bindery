# Bindery 웹 AI 교환 패킷

이 문서는 Bindery(로컬 집필 하네스)가 만든 **단일 단계 작업 패킷**입니다.
CLI 에이전트 대신 ChatGPT/Claude/Gemini 웹 UI에 이 패킷을 붙여 넣고, 아래 "요구 출력"의 형식 그대로 응답을 받아 Bindery에 다시 붙여 넣으면 됩니다.

- exchange_id: {{exchangeId}}
- stage: {{stage}}
- created: {{createdAt}}

## 응답 규칙 (중요)
1. 아래 "요구 출력" 섹션의 형식(JSON이면 JSON object 하나)만 출력하십시오.
2. 인사말, 설명, 마크다운 코드펜스 밖의 텍스트를 붙이지 마십시오.
3. 입력 파일에 없는 사실을 확정하지 마십시오. 불확실하면 risk 필드에 표시하십시오.

## 작업 프롬프트
{{prompt}}

## 요구 출력
{{expectedOutput}}
