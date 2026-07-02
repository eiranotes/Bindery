# 16. Security and Privacy

## 1. 기본 원칙

- 사용자의 원고는 로컬 파일이 source of truth다.
- 앱은 사용자의 명시적 실행 없이 AI로 원고를 보내지 않는다.
- AI 호출 전 어떤 파일이 포함되는지 확인할 수 있어야 한다.
- 프로젝트 root 밖 파일 접근은 기본 금지한다.
- secret/token/credential 파일은 자동 수집하지 않는다.

## 2. AI 호출 투명성

각 job은 input manifest를 남긴다.

```json
{
  "jobId": "job_ep012_style_qa",
  "agent": "style-qa",
  "inputFiles": [
    "story/chapters/ep012/13_final.md",
    "style/reference-profile.md"
  ],
  "excludedFiles": [
    "notes/private/*"
  ]
}
```

GUI에서 `View Prompt Package` 버튼 제공.

## 3. Path sandbox

Tauri backend는 다음을 검사한다.

- relative path only.
- no `..` traversal.
- symlink target must remain inside project root.
- `.git`, `.ssh`, `.env`, token files are denylisted by default.

## 4. Sensitive file policy

기본 deny patterns:

```yaml
deny_patterns:
  - ".env"
  - "*.pem"
  - "*.key"
  - "secrets/**"
  - ".git/**"
  - ".ssh/**"
```

Project-specific override는 가능하지만 경고가 필요하다.

## 5. Agent permissions

Agent별 input scope를 제한한다.

```yaml
agents:
  style-qa:
    read:
      - "story/chapters/{episode}/13_final.md"
      - "style/**"
      - "preferences/writing-preferences.md"
    write:
      - "story/chapters/{episode}/08_style-qa.md"
```

MVP에서는 강제 enforcement는 novelctl에서 하고, v1에서는 Tauri에서도 validation한다.

## 6. Destructive operation confirmation

Confirmation required:

- delete file.
- restore snapshot.
- overwrite final.
- apply bulk dynamic links.
- apply canon delta.
- git reset/checkout.

## 7. Local logs

Logs may contain prompt snippets. Therefore:

- logs stored inside project `.novelctl/runs`.
- user can purge logs.
- public-safe export excludes logs by default.

## 8. Privacy modes

| Mode | Behavior |
|---|---|
| Normal | Gemini CLI calls enabled |
| Local-only | AI disabled, local analysis only |
| Review-before-send | every AI run shows input package first |
| Public-safe export | excludes notes/private, runs, prompts, raw logs |
