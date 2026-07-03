"""Bindery structured style runtime MVP.

The module intentionally does not perform model fine-tuning. It treats presets as
prompt adapters, classifies scenes with deterministic surface features, resolves
style stacks, builds compact PromptCapsules, scores style fit, and exports a
Markdown SkillPack runtime.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field, is_dataclass
from pathlib import Path
import datetime as _dt
import hashlib
import json
import math
import re
import sqlite3
from typing import Any, Literal
import zipfile

SceneTag = Literal["OBS", "DIA", "ACT", "INF", "CON", "MOV", "AFT", "TRN", "INT", "REL"]
StyleRegister = Literal[
    "observation",
    "dialogue",
    "action",
    "exposition",
    "conflict",
    "movement",
    "aftermath",
    "quiet_transition",
    "internal_overlay",
    "relationship_overlay",
]

ALL_SCENE_TAGS: list[str] = ["OBS", "DIA", "ACT", "INF", "CON", "MOV", "AFT", "TRN", "INT", "REL"]
CORE_SCENE_TAGS: list[str] = ["OBS", "DIA", "ACT", "INF", "CON", "MOV", "AFT", "TRN"]
STYLE_REGISTER_BY_TAG: dict[str, str] = {
    "OBS": "observation",
    "DIA": "dialogue",
    "ACT": "action",
    "INF": "exposition",
    "CON": "conflict",
    "MOV": "movement",
    "AFT": "aftermath",
    "TRN": "quiet_transition",
    "INT": "internal_overlay",
    "REL": "relationship_overlay",
}

MARKERS: dict[str, list[str]] = {
    "observation_density": ["빛", "그림자", "냄새", "소리", "차갑", "뜨겁", "희미", "선명", "어둡", "밝", "벽", "문", "창", "공기", "바닥", "천장"],
    "action_verb_density": ["잡", "놓", "들", "밀", "당겼", "돌렸", "움직", "고개", "손", "발", "몸", "열었", "닫았", "내려", "올려"],
    "exposition_marker_density": ["이유", "때문", "원래", "과거", "사실", "설명", "의미", "구조", "규칙", "조건", "시스템", "따라서"],
    "conflict_intensity": ["위험", "비명", "공격", "충돌", "피", "죽", "위협", "압박", "추궁", "거짓말", "분노", "소리쳤", "무너", "도망"],
    "movement_marker_density": ["걸", "뛰", "달려", "다가", "물러", "향했", "들어", "나갔", "올라", "내려", "도착", "떠났", "지나"],
    "aftermath_marker_density": ["뒤", "후", "끝나", "남았", "가라앉", "정리", "수습", "잠잠", "확인", "숨을 골랐다", "침묵이 남"],
    "transition_marker_density": ["잠시", "그 후", "다음", "이윽고", "문득", "한동안", "곧", "다시", "며칠 뒤", "다음 날"],
    "internal_judgment_density": ["생각했다", "알았다", "깨달", "느꼈", "듯했다", "같았다", "아마", "어쩌면", "인지도", "결심", "망설"],
    "relationship_shift_density": ["선생", "님", "야", "씨", "믿", "오해", "미안", "고마", "거리", "말투", "호칭", "약속", "배신", "용서", "신뢰"],
}

DEFAULT_NEGATIVE_RULES = [
    "원문 고유명사와 사건 구조를 가져오지 않는다.",
    "primary_type의 register를 secondary overlay가 덮어쓰지 않게 한다.",
    "특정 장면의 사물 나열이나 동선 순서를 전역 문체로 반복하지 않는다.",
]
ACTION_VERB_MARKERS = sorted(set(MARKERS["action_verb_density"] + ["건넸", "꺼냈", "밀어", "눌렀", "찢", "접", "펼", "멈췄"]))
JUDGMENT_MARKERS = sorted(set(MARKERS["internal_judgment_density"] + ["판단", "확신", "의심", "예상", "결론", "선택"]))
RELATIONSHIP_MARKERS = sorted(set(MARKERS["relationship_shift_density"] + ["존댓말", "반말", "사과", "거절", "승낙", "경계"]))
EMOTION_MARKERS = ["슬픔", "불안", "분노", "후회", "두려", "기쁨", "안도", "망설", "당황", "놀라"]
FEWSHOT_MAX_FILES = 12
FEWSHOT_MAX_BYTES = 120_000

def _load_sqlite_schema() -> str:
    return (Path(__file__).with_name("migrations") / "001_style_system.sql").read_text(encoding="utf-8").strip()


SQLITE_SCHEMA = _load_sqlite_schema()

SCENE_CLASSIFICATION_CORRECTION_SCHEMA: dict[str, Any] = {
    "name": "scene_classification_correction",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["scene_id", "primary_type", "secondary_types", "surface_mode", "style_register", "confidence", "reason"],
        "properties": {
            "scene_id": {"type": "string"},
            "primary_type": {"type": "string", "enum": ALL_SCENE_TAGS},
            "secondary_types": {"type": "array", "items": {"type": "string", "enum": ALL_SCENE_TAGS}, "maxItems": 4},
            "surface_mode": {"type": "string"},
            "style_register": {"type": "string"},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "reason": {"type": "string"},
            "manual_override": {"type": "boolean"},
        },
    },
}
PARAGRAPH_FUNCTION_TAGGING_SCHEMA: dict[str, Any] = {
    "name": "paragraph_function_tags",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["scene_id", "paragraphs"],
        "properties": {
            "scene_id": {"type": "string"},
            "paragraphs": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["index", "function", "evidence"],
                    "properties": {
                        "index": {"type": "integer", "minimum": 0},
                        "function": {"type": "string"},
                        "evidence": {"type": "string"},
                    },
                },
            },
        },
    },
}
SCORING_EXPLANATION_SCHEMA: dict[str, Any] = {
    "name": "style_score_explanation",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["report_id", "explanation", "local_score_used"],
        "properties": {
            "report_id": {"type": "string"},
            "explanation": {"type": "string"},
            "local_score_used": {"type": "boolean", "const": True},
            "risk_notes": {"type": "array", "items": {"type": "string"}},
        },
    },
}
STYLE_SUGGESTION_SCHEMA: dict[str, Any] = {
    "name": "style_suggestion",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["suggestions", "score_guard"],
        "properties": {
            "suggestions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["issue", "suggestion", "local_evidence"],
                    "properties": {
                        "issue": {"type": "string"},
                        "suggestion": {"type": "string"},
                        "local_evidence": {"type": "string"},
                    },
                },
            },
            "score_guard": {"type": "string", "enum": ["llm_must_not_set_total_score"]},
        },
    },
}
STRUCTURED_OUTPUT_SCHEMAS = {
    "scene_classification": SCENE_CLASSIFICATION_CORRECTION_SCHEMA,
    "paragraph_functions": PARAGRAPH_FUNCTION_TAGGING_SCHEMA,
    "scoring_explanation": SCORING_EXPLANATION_SCHEMA,
    "suggestion": STYLE_SUGGESTION_SCHEMA,
}


def _now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat()


def migration_files() -> list[Path]:
    return sorted((Path(__file__).with_name("migrations")).glob("*.sql"))


def style_db_path(project: Path) -> Path:
    return project / ".bindery" / "style-system.sqlite3"


def apply_style_migrations(project: Path) -> Path:
    db_path = style_db_path(project)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as con:
        con.execute("CREATE TABLE IF NOT EXISTS style_migrations (name TEXT PRIMARY KEY, applied_at TEXT)")
        applied = {row[0] for row in con.execute("SELECT name FROM style_migrations")}
        for migration in migration_files():
            if migration.name in applied:
                continue
            con.executescript(migration.read_text(encoding="utf-8"))
            con.execute("INSERT INTO style_migrations(name, applied_at) VALUES (?, ?)", (migration.name, _now()))
        con.commit()
    return db_path


def _read_json_files(root: Path) -> list[dict[str, Any]]:
    if not root.exists():
        return []
    out = []
    for path in sorted(root.glob("*.json")):
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                out.append(raw)
        except json.JSONDecodeError:
            continue
    return out


def _upsert_json(con: sqlite3.Connection, table: str, key: str, key_value: str, json_col: str, payload: dict[str, Any], extra: dict[str, Any]) -> None:
    columns = [key, *extra.keys(), json_col, "created_at", "updated_at"]
    values = [key_value, *extra.values(), json.dumps(payload, ensure_ascii=False), payload.get("created_at") or _now(), _now()]
    placeholders = ", ".join("?" for _ in columns)
    update = ", ".join(f"{col}=excluded.{col}" for col in [*extra.keys(), json_col, "updated_at"])
    con.execute(
        f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders}) ON CONFLICT({key}) DO UPDATE SET {update}",
        values,
    )


def sync_style_repository(project: Path) -> dict[str, Any]:
    db_path = apply_style_migrations(project)
    styles = project / "styles"
    styles.mkdir(parents=True, exist_ok=True)
    counts = {"profiles": 0, "presets": 0, "stacks": 0, "router_rules": 0, "classifications": 0, "reports": 0}
    with sqlite3.connect(db_path) as con:
        for raw in _read_json_files(styles / "profiles"):
            profile_id = raw.get("profile_id")
            if not profile_id:
                continue
            _upsert_json(con, "style_profiles", "profile_id", profile_id, "profile_json", raw, {
                "project_id": raw.get("project_id"),
                "source_title": raw.get("source_title"),
                "language": raw.get("language", "ko"),
            })
            counts["profiles"] += 1
        for raw in _read_json_files(styles / "presets"):
            preset_id = raw.get("preset_id")
            if not preset_id:
                continue
            _upsert_json(con, "style_presets", "preset_id", preset_id, "preset_json", raw, {
                "project_id": raw.get("project_id"),
                "name": raw.get("name", preset_id),
                "description": raw.get("description"),
                "source_profile_id": raw.get("source_profile_id"),
                "preset_type": raw.get("preset_type", "mixed"),
                "default_strength": raw.get("default_strength", 0.75),
            })
            counts["presets"] += 1
        for raw in _read_json_files(styles / "stacks"):
            stack_id = raw.get("stack_id")
            if not stack_id:
                continue
            _upsert_json(con, "style_stacks", "stack_id", stack_id, "stack_json", raw, {
                "project_id": raw.get("project_id"),
                "name": raw.get("name", stack_id),
                "description": raw.get("description"),
            })
            counts["stacks"] += 1
        routers = _read_json_files(styles / "routers")
        router_path = styles / "router.json"
        if router_path.exists():
            try:
                raw = json.loads(router_path.read_text(encoding="utf-8"))
                if isinstance(raw, dict):
                    routers.append(raw)
            except json.JSONDecodeError:
                pass
        for router in routers:
            router_id = router.get("router_id", "router_default")
            for rule in router.get("rules", []):
                rule_id = rule.get("rule_id")
                if not rule_id:
                    continue
                _upsert_json(con, "style_router_rules", "rule_id", rule_id, "rule_json", rule, {
                    "project_id": router.get("project_id"),
                    "router_id": router_id,
                    "target_type": rule.get("target_type"),
                    "target_value": rule.get("target_value"),
                    "stack_id": rule.get("stack_id"),
                    "priority": rule.get("priority", 0),
                })
                counts["router_rules"] += 1
        for raw in _read_json_files(styles / "classifications"):
            scene_id = raw.get("scene_id")
            if not scene_id:
                continue
            _upsert_json(con, "scene_classifications", "scene_id", scene_id, "classification_json", raw, {
                "project_id": raw.get("project_id"),
                "chapter_id": raw.get("chapter_id"),
                "primary_type": raw.get("primary_type"),
                "secondary_types_json": json.dumps(raw.get("secondary_types", []), ensure_ascii=False),
                "surface_mode": raw.get("surface_mode"),
                "narrative_functions_json": json.dumps(raw.get("narrative_functions", []), ensure_ascii=False),
                "style_register": raw.get("style_register"),
                "confidence": raw.get("confidence", 0),
                "manual_override": 1 if raw.get("manual_override") else 0,
            })
            counts["classifications"] += 1
        for raw in _read_json_files(styles / "reports"):
            report_id = raw.get("report_id")
            if not report_id:
                continue
            _upsert_json(con, "style_match_reports", "report_id", report_id, "report_json", raw, {
                "project_id": raw.get("project_id"),
                "target_text_id": raw.get("target_text_id"),
                "stack_id": raw.get("stack_id"),
                "total_score": raw.get("total_score", 0),
            })
            counts["reports"] += 1
        con.commit()
    summary = {
        "db_path": str(db_path),
        "styles_dir": str(styles),
        "sync_policy": "styles/*.json is the editable source; SQLite is a query/index cache rebuilt by style-sync.",
        "counts": counts,
    }
    (styles / "style-repository.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary


@dataclass
class StyleRule:
    rule_id: str
    instruction: str
    axis: str = ""
    strength: float = 1.0
    source: str = "manual"


@dataclass
class StyleProfile:
    profile_id: str
    language: str = "ko"
    schema_version: str = "bindery.style.profile.v1"
    project_id: str | None = None
    source_title: str | None = None
    global_rules: list[StyleRule] = field(default_factory=list)
    register_rules: dict[str, list[StyleRule]] = field(default_factory=dict)
    overlay_rules: dict[str, list[StyleRule]] = field(default_factory=dict)
    character_rules: dict[str, list[StyleRule]] = field(default_factory=dict)
    negative_rules: list[str] = field(default_factory=list)
    content_terms: list[str] = field(default_factory=list)
    style_axes: dict[str, float] = field(default_factory=dict)
    metrics_baseline: dict[str, float] = field(default_factory=dict)
    created_at: str | None = None
    updated_at: str | None = None


@dataclass
class StylePreset:
    preset_id: str
    name: str
    preset_type: str = "mixed"
    default_strength: float = 0.75
    description: str = ""
    project_id: str | None = None
    source_profile_id: str | None = None
    allowed_scopes: list[str] = field(default_factory=lambda: ["project", "chapter", "scene", "dialogue", "character"])
    style_axes: dict[str, float] = field(default_factory=dict)
    register_availability: dict[str, bool] = field(default_factory=dict)
    compact_instruction: str = ""
    global_rules: list[StyleRule] = field(default_factory=list)
    register_rules: dict[str, list[StyleRule]] = field(default_factory=dict)
    overlay_rules: dict[str, list[StyleRule]] = field(default_factory=dict)
    character_rules: dict[str, list[StyleRule]] = field(default_factory=dict)
    negative_rules: list[str] = field(default_factory=list)
    fewshot_refs: list[str] = field(default_factory=list)
    content_terms: list[str] = field(default_factory=list)
    metrics_baseline: dict[str, float] = field(default_factory=dict)


@dataclass
class StyleStackAdapter:
    preset_id: str
    role: str = "base"
    weight: float = 1.0
    scope: str = "global"
    enabled: bool = True
    compatible_scene_types: list[str] = field(default_factory=list)
    compatible_registers: list[str] = field(default_factory=list)
    rule_overrides: list[StyleRule] = field(default_factory=list)


@dataclass
class StyleStack:
    stack_id: str
    name: str
    adapters: list[StyleStackAdapter] = field(default_factory=list)
    description: str = ""
    project_id: str | None = None
    base_preset_id: str | None = None
    presets: list[StylePreset] = field(default_factory=list)
    conflict_policy: str = "scope_priority"
    normalization: str = "weighted_average"
    max_active_rules: int = 18
    global_rules: list[StyleRule] = field(default_factory=list)
    register_rules: dict[str, list[StyleRule]] = field(default_factory=dict)
    overlay_rules: dict[str, list[StyleRule]] = field(default_factory=dict)
    character_rules: dict[str, list[StyleRule]] = field(default_factory=dict)
    negative_rules: list[str] = field(default_factory=list)
    fewshot_refs: list[str] = field(default_factory=list)


@dataclass
class SceneFeatureScores:
    dialogue_ratio: float = 0
    observation_density: float = 0
    action_verb_density: float = 0
    exposition_marker_density: float = 0
    conflict_intensity: float = 0
    movement_marker_density: float = 0
    aftermath_marker_density: float = 0
    transition_marker_density: float = 0
    internal_judgment_density: float = 0
    relationship_shift_density: float = 0


@dataclass
class SceneClassification:
    scene_id: str
    chapter_id: str | None
    primary_type: str
    secondary_types: list[str]
    surface_mode: str
    narrative_functions: list[str]
    style_register: str
    confidence: float
    scores: dict[str, float]
    feature_scores: SceneFeatureScores
    manual_override: bool = False


@dataclass
class StyleRouterRule:
    rule_id: str
    target_type: str
    target_value: str
    stack_id: str
    priority: int = 0
    enabled: bool = True
    overlay: bool = True
    compatible_scene_types: list[str] = field(default_factory=list)
    compatible_registers: list[str] = field(default_factory=list)


@dataclass
class StyleRouter:
    router_id: str
    rules: list[StyleRouterRule] = field(default_factory=list)
    project_id: str | None = None
    default_stack_id: str | None = None


@dataclass
class StyleRouteContext:
    scene_id: str
    classification: SceneClassification
    project_id: str | None = None
    arc_id: str | None = None
    chapter_id: str | None = None
    character_id: str | None = None
    dialogue_speakers: list[str] = field(default_factory=list)
    manual_override_stack_id: str | None = None
    revision_pass: str | None = None


@dataclass
class ActiveStyleStack:
    primary_stack_id: str
    overlay_stack_ids: list[str]
    matched_rules: list[StyleRouterRule]
    routing_reason: str


@dataclass
class MergedStyleRules:
    stack_id: str
    global_rules: list[dict[str, Any]]
    register_rules: list[dict[str, Any]]
    overlay_rules: list[dict[str, Any]]
    character_rules: list[dict[str, Any]]
    negative_rules: list[str]
    diagnostics: list[str]
    active_rule_count: int


@dataclass
class PromptCapsule:
    active_stack: str
    scene_type: str
    style_register: str
    secondary_types: list[str]
    global_rules: list[str]
    register_rules: list[str]
    overlay_rules: list[str]
    character_rules: list[str]
    negative_rules: list[str]
    fewshot_refs: list[str]
    self_checklist: list[str]


@dataclass
class StyleMatchReport:
    report_id: str
    total_score: float
    global_fit: float
    register_fit: float
    scene_classification_fit: float
    stack_blend_fit: float
    rhythm_fit: float
    discourse_fit: float
    dialogue_fit: float
    lexical_fit: float
    fluency: float
    leakage_penalty: float
    register_mismatch_penalty: float
    overfit_penalty: float
    diagnostics: list[str]


def to_plain(obj: Any) -> Any:
    if is_dataclass(obj):
        return {k: to_plain(v) for k, v in asdict(obj).items()}
    if isinstance(obj, list):
        return [to_plain(x) for x in obj]
    if isinstance(obj, dict):
        return {k: to_plain(v) for k, v in obj.items()}
    return obj


def _id(prefix: str, seed: str = "") -> str:
    seed = seed or f"{prefix}-{_dt.datetime.now(_dt.timezone.utc).isoformat()}"
    return f"{prefix}_{hashlib.sha1(seed.encode('utf-8')).hexdigest()[:10]}"


def _clamp01(n: float) -> float:
    return round(max(0.0, min(1.0, n)), 4)


def split_sentences(text: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", text).strip()
    if not normalized:
        return []
    parts = [p.strip() for p in re.split(r"(?<=[.!?。！？…])\s+|(?<=[다요죠까냐네음임함됨했였었았])\s+", normalized) if len(p.strip()) > 1]
    return parts or [normalized]


def _count_markers(text: str, markers: list[str]) -> int:
    return sum(text.count(marker) for marker in markers)


def _dialogue_ratio(text: str, sentences: list[str]) -> float:
    quoted = re.findall(r"[「『“\"][^」』”\"]+[」』”\"]", text)
    quote_chars = sum(len(q) for q in quoted)
    char_count = len(re.sub(r"\s", "", text)) or 1
    char_ratio = quote_chars / char_count
    sentence_ratio = len([s for s in sentences if re.search(r"[「『“\"].+[」』”\"]", s) or re.match(r"^[-—]\s*", s)]) / max(1, len(sentences))
    line_bonus = 0.15 if any(re.match(r"^\s*(?:[「『“\"]|[-—]\s*)", line) for line in text.splitlines()) else 0
    return _clamp01(max(char_ratio, sentence_ratio) + line_bonus + (0.15 if len(quoted) >= 2 else 0))


def _density(text: str, marker_key: str, divisor: float = 7.0) -> float:
    sentences = max(1, len(split_sentences(text)))
    count = _count_markers(text, MARKERS[marker_key])
    return _clamp01(count / max(divisor, sentences * 1.6))


def _density_for_markers(text: str, markers: list[str], divisor: float = 7.0) -> float:
    sentences = max(1, len(split_sentences(text)))
    count = _count_markers(text, markers)
    return _clamp01(count / max(divisor, sentences * 1.6))


def compute_scene_feature_scores(scene_text: str) -> SceneFeatureScores:
    sentences = split_sentences(scene_text)
    return SceneFeatureScores(
        dialogue_ratio=_dialogue_ratio(scene_text, sentences),
        observation_density=_density(scene_text, "observation_density", 7),
        action_verb_density=_density_for_markers(scene_text, ACTION_VERB_MARKERS, 7),
        exposition_marker_density=_density(scene_text, "exposition_marker_density", 5),
        conflict_intensity=_density(scene_text, "conflict_intensity", 5),
        movement_marker_density=_density(scene_text, "movement_marker_density", 5),
        aftermath_marker_density=_density(scene_text, "aftermath_marker_density", 5),
        transition_marker_density=_density(scene_text, "transition_marker_density", 5),
        internal_judgment_density=_density_for_markers(scene_text, JUDGMENT_MARKERS, 5),
        relationship_shift_density=_density_for_markers(scene_text, RELATIONSHIP_MARKERS, 5),
    )


def _marker_counts(text: str, markers: list[str]) -> dict[str, int]:
    return {marker: count for marker in markers if (count := text.count(marker)) > 0}


def _top_counts(items: list[str], limit: int = 12) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        counts[item] = counts.get(item, 0) + 1
    return dict(sorted(counts.items(), key=lambda x: (-x[1], x[0]))[:limit])


def analyze_korean_surface(text: str, speaker_aliases: list[str] | None = None) -> dict[str, Any]:
    """Deterministic Korean surface report.

    This is not a full morphology engine. It exposes the dictionary-backed
    signals the UI and LLM guards need, while keeping speaker attribution manual.
    """
    speaker_aliases = speaker_aliases or []
    eojeol = re.findall(r"[가-힣A-Za-z0-9]+", text)
    endings = re.findall(r"(습니다|습니까|세요|했다|였다|었다|았다|한다|된다|이다|다|요|죠|까|냐|네|군)(?:[.!?…\"”’」』)]|\s|$)", text)
    particles = re.findall(r"[가-힣]+(은|는|이|가|을|를|에|에서|으로|와|과|도|만)(?:\s|$)", text)
    quoted = re.findall(r"[「『“\"]([^」』”\"]+)[」』”\"]", text)
    candidate_speakers = []
    for alias in speaker_aliases:
        if alias and alias in text:
            candidate_speakers.append({"speaker": alias, "count": text.count(alias), "source": "provided_alias"})
    for marker in RELATIONSHIP_MARKERS:
        if marker in text and marker not in speaker_aliases:
            candidate_speakers.append({"speaker": marker, "count": text.count(marker), "source": "relationship_marker"})
    return {
        "morphology": {
            "eojeol_count": len(eojeol),
            "unique_eojeol_ratio": _clamp01(len(set(eojeol)) / max(1, len(eojeol))),
            "sentence_count": len(split_sentences(text)),
            "ending_counts": _top_counts(list(endings)),
            "particle_counts": _top_counts(list(particles)),
            "honorific_counts": _marker_counts(text, ["습니다", "습니까", "세요", "셨", "께서", "드립니다"]),
        },
        "action_verbs": _marker_counts(text, ACTION_VERB_MARKERS),
        "judgment_markers": _marker_counts(text, JUDGMENT_MARKERS),
        "relationship_markers": _marker_counts(text, RELATIONSHIP_MARKERS),
        "emotion_markers": _marker_counts(text, EMOTION_MARKERS),
        "dialogue": {
            "quoted_block_count": len(quoted),
            "quoted_blocks": quoted[:8],
            "manual_speaker_correction_first": True,
            "speaker_candidates": candidate_speakers[:12],
        },
    }


def _scores_from_features(f: SceneFeatureScores) -> dict[str, float]:
    return {
        "DIA": f.dialogue_ratio,
        "OBS": f.observation_density,
        "ACT": f.action_verb_density,
        "INF": f.exposition_marker_density,
        "CON": f.conflict_intensity,
        "MOV": f.movement_marker_density,
        "AFT": f.aftermath_marker_density,
        "TRN": f.transition_marker_density,
        "INT": f.internal_judgment_density,
        "REL": f.relationship_shift_density,
    }


def _select_primary(scores: dict[str, float]) -> str:
    core = sorted(((tag, scores[tag]) for tag in CORE_SCENE_TAGS), key=lambda x: x[1], reverse=True)
    overlay = sorted(((tag, scores[tag]) for tag in ["REL", "INT"]), key=lambda x: x[1], reverse=True)
    if core[0][1] >= 0.12:
        return core[0][0]
    if overlay[0][1] >= 0.45 and overlay[0][1] > core[0][1] + 0.2:
        return overlay[0][0]
    return core[0][0]


def _select_secondary(primary: str, scores: dict[str, float]) -> list[str]:
    def threshold(tag: str) -> float:
        return 0.24 if tag in {"REL", "INT"} else 0.34

    return [tag for tag, _ in sorted(((tag, scores[tag]) for tag in ALL_SCENE_TAGS if tag != primary and scores[tag] >= threshold(tag)), key=lambda x: x[1], reverse=True)[:4]]


def _surface_mode(scores: dict[str, float]) -> str:
    if scores["DIA"] >= 0.42:
        return "dialogue-heavy"
    if scores["INF"] >= 0.42:
        return "exposition-heavy"
    if scores["ACT"] >= 0.4 or scores["MOV"] >= 0.4 or scores["CON"] >= 0.45:
        return "action-heavy"
    if scores["INT"] >= 0.42:
        return "internal-heavy"
    if scores["OBS"] >= 0.3:
        return "description-heavy"
    return "mixed"


def _narrative_functions(primary: str, secondary: list[str]) -> list[str]:
    tags = {primary, *secondary}
    out: list[str] = []
    if "INF" in tags:
        out.append("information_reveal")
    if "REL" in tags:
        out.append("relationship_shift")
    if "CON" in tags:
        out.append("tension_escalation")
    if "MOV" in tags:
        out.append("movement")
    if "AFT" in tags:
        out.append("aftermath_processing")
    if "TRN" in tags:
        out.append("scene_transition")
    if "INT" in tags:
        out.append("emotional_shift")
    if primary == "ACT":
        out.append("preparation")
    if not out and primary == "DIA":
        out.append("partial_reveal")
    return list(dict.fromkeys(out))[:4]


def classify_scene(scene_text: str, metadata: dict[str, Any] | None = None) -> SceneClassification:
    metadata = metadata or {}
    features = compute_scene_feature_scores(scene_text)
    scores = _scores_from_features(features)
    primary = _select_primary(scores)
    secondary = _select_secondary(primary, scores)
    ranked = sorted(scores.values(), reverse=True)
    confidence = _clamp01(0.48 + scores[primary] * 0.35 + max(0.0, ranked[0] - (ranked[1] if len(ranked) > 1 else 0)) * 0.35)
    return SceneClassification(
        scene_id=str(metadata.get("scene_id") or metadata.get("sceneId") or "S001"),
        chapter_id=metadata.get("chapter_id") or metadata.get("chapterId"),
        primary_type=primary,
        secondary_types=secondary,
        surface_mode=_surface_mode(scores),
        narrative_functions=_narrative_functions(primary, secondary),
        style_register=STYLE_REGISTER_BY_TAG[primary],
        confidence=confidence,
        scores=scores,
        feature_scores=features,
        manual_override=bool(metadata.get("manual_override") or metadata.get("manualOverride") or False),
    )


SCOPE_PRIORITY = {
    "manual_override": 1000,
    "character_dialogue": 900,
    "dialogue": 800,
    "scene_id": 700,
    "style_register": 650,
    "scene_type": 600,
    "chapter": 500,
    "arc": 400,
    "project_default": 300,
    "project": 300,
    "paragraph_range": 250,
    "revision_pass": 200,
}


def _normalize_character(value: str) -> str:
    return re.sub(r"^character[_:-]", "", value).strip()


def _rule_matches(rule: StyleRouterRule, context: StyleRouteContext) -> bool:
    if not rule.enabled:
        return False
    c = context.classification
    value = rule.target_value
    if rule.target_type == "manual_override":
        return bool(context.manual_override_stack_id) and value in {"*", context.manual_override_stack_id, rule.stack_id}
    if rule.target_type == "character_dialogue":
        if c.primary_type != "DIA" and c.style_register != "dialogue":
            return False
        target = _normalize_character(value)
        return context.character_id == target or target in [_normalize_character(s) for s in context.dialogue_speakers]
    if rule.target_type == "dialogue":
        return c.primary_type == "DIA" or c.style_register == "dialogue"
    if rule.target_type == "scene_id":
        return value == context.scene_id
    if rule.target_type == "style_register":
        return value == c.style_register
    if rule.target_type == "scene_type":
        return value == c.primary_type or value in c.secondary_types
    if rule.target_type == "chapter":
        return bool(context.chapter_id) and value == context.chapter_id
    if rule.target_type == "arc":
        return bool(context.arc_id) and value == context.arc_id
    if rule.target_type in {"project_default", "project"}:
        return value == "*" or not context.project_id or value == context.project_id
    if rule.target_type == "revision_pass":
        return bool(context.revision_pass) and value == context.revision_pass
    return False


def _route_sort_key(rule: StyleRouterRule) -> tuple[int, int]:
    return (SCOPE_PRIORITY.get(rule.target_type, 0), rule.priority)


def _compatible_overlay(rule: StyleRouterRule, primary: StyleRouterRule, context: StyleRouteContext) -> bool:
    if rule.stack_id == primary.stack_id or rule.overlay is False:
        return False
    tags = [context.classification.primary_type, *context.classification.secondary_types]
    if rule.compatible_scene_types and not any(tag in tags for tag in rule.compatible_scene_types):
        return False
    if rule.compatible_registers and context.classification.style_register not in rule.compatible_registers:
        return False
    return True


def resolve_active_style_stack(context: StyleRouteContext, router: StyleRouter) -> ActiveStyleStack:
    if context.manual_override_stack_id:
        manual = StyleRouterRule("manual_override_runtime", "manual_override", context.manual_override_stack_id, context.manual_override_stack_id, 1000, True, False)
        return ActiveStyleStack(context.manual_override_stack_id, [], [manual], "manual_override matched first")
    matched = sorted([r for r in router.rules if _rule_matches(r, context)], key=_route_sort_key, reverse=True)
    if not matched:
        return ActiveStyleStack(router.default_stack_id or "stack_default", [], [], "no rule matched; default stack applied")
    primary = matched[0]
    overlays = [r for r in matched[1:] if _compatible_overlay(r, primary, context)]
    overlay_ids = list(dict.fromkeys(r.stack_id for r in overlays))
    reason = f"{primary.target_type} matched first" + ("; compatible overlays applied" if overlay_ids else "")
    return ActiveStyleStack(primary.stack_id, overlay_ids, [primary, *overlays], reason)


def _weighted(rule: StyleRule, weight: float, source: str, stack_id: str, preset_id: str | None = None) -> dict[str, Any]:
    boost = {"character": 40, "register": 30, "overlay": 20, "global": 10}.get(source, 0)
    return {**to_plain(rule), "source": source, "weight": _clamp01(weight), "priority": round(weight * 100) + boost, "source_stack_id": stack_id, "source_preset_id": preset_id}


def _preset_map(stack: StyleStack) -> dict[str, StylePreset]:
    return {p.preset_id: p for p in stack.presets}


def _adapter_applies(adapter: StyleStackAdapter, c: SceneClassification, character_id: str | None) -> bool:
    if not adapter.enabled:
        return False
    tags = [c.primary_type, *c.secondary_types]
    if adapter.compatible_scene_types and not any(tag in tags for tag in adapter.compatible_scene_types):
        return False
    if adapter.compatible_registers and c.style_register not in adapter.compatible_registers:
        return False
    if adapter.scope.startswith("character:"):
        return bool(character_id) and adapter.scope == f"character:{character_id}"
    if adapter.scope in {"global", c.style_register, c.primary_type}:
        return True
    if adapter.scope in c.secondary_types:
        return True
    if adapter.scope == "dialogue":
        return c.primary_type == "DIA" or c.style_register == "dialogue"
    if adapter.scope == "conflict":
        return c.primary_type == "CON" or "CON" in c.secondary_types
    return False


def _dedupe_rules(rules: list[dict[str, Any]], policy: str) -> list[dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for rule in rules:
        key = rule.get("instruction", "").strip()
        prev = out.get(key)
        if prev is None:
            out[key] = rule
        elif policy == "higher_weight" and rule.get("weight", 0) > prev.get("weight", 0):
            out[key] = rule
        elif rule.get("priority", 0) > prev.get("priority", 0):
            out[key] = rule
    return sorted(out.values(), key=lambda r: r.get("priority", 0), reverse=True)


def _cap_buckets(buckets: list[list[dict[str, Any]]], max_rules: int) -> None:
    total = sum(len(b) for b in buckets)
    while total > max_rules:
        target = max(buckets, key=len)
        if not target:
            return
        target.pop()
        total -= 1


def merge_style_stack(stack: StyleStack, scene_classification: SceneClassification, character_id: str | None = None, token_budget: int = 1200) -> MergedStyleRules:
    global_rules: list[dict[str, Any]] = [_weighted(r, 1, "global", stack.stack_id) for r in stack.global_rules]
    register_rules: list[dict[str, Any]] = [_weighted(r, 1, "register", stack.stack_id) for r in stack.register_rules.get(scene_classification.style_register, [])]
    overlay_rules: list[dict[str, Any]] = []
    character_rules: list[dict[str, Any]] = []
    negative = set(DEFAULT_NEGATIVE_RULES + stack.negative_rules)
    presets = _preset_map(stack)

    for tag in scene_classification.secondary_types:
        overlay_rules.extend(_weighted(r, 0.8, "overlay", stack.stack_id) for r in stack.overlay_rules.get(tag, []))
    if character_id:
        character_rules.extend(_weighted(r, 1, "character", stack.stack_id) for r in stack.character_rules.get(character_id, []))

    for adapter in stack.adapters:
        if not _adapter_applies(adapter, scene_classification, character_id):
            continue
        preset = presets.get(adapter.preset_id)
        if not preset:
            overlay_rules.extend(_weighted(r, adapter.weight, "overlay", stack.stack_id, adapter.preset_id) for r in adapter.rule_overrides)
            continue
        if adapter.scope == "global" or adapter.role == "base":
            global_rules.extend(_weighted(r, adapter.weight, "global", stack.stack_id, preset.preset_id) for r in preset.global_rules)
        register_rules.extend(_weighted(r, adapter.weight, "register", stack.stack_id, preset.preset_id) for r in preset.register_rules.get(scene_classification.style_register, []))
        for tag in scene_classification.secondary_types:
            overlay_rules.extend(_weighted(r, adapter.weight * 0.9, "overlay", stack.stack_id, preset.preset_id) for r in preset.overlay_rules.get(tag, []))
        if character_id:
            character_rules.extend(_weighted(r, adapter.weight, "character", stack.stack_id, preset.preset_id) for r in preset.character_rules.get(character_id, []))
        negative.update(preset.negative_rules)
        overlay_rules.extend(_weighted(r, adapter.weight, "overlay", stack.stack_id, preset.preset_id) for r in adapter.rule_overrides)

    global_rules = _dedupe_rules(global_rules, stack.conflict_policy)
    register_rules = _dedupe_rules(register_rules, stack.conflict_policy)
    overlay_rules = _dedupe_rules(overlay_rules, stack.conflict_policy)
    character_rules = _dedupe_rules(character_rules, stack.conflict_policy)
    max_rules = max(4, min(stack.max_active_rules, token_budget // 45))
    _cap_buckets([character_rules, register_rules, overlay_rules, global_rules], max_rules)
    diagnostics = ["secondary_types applied as overlays only", f"conflict_policy={stack.conflict_policy}"]
    return MergedStyleRules(stack.stack_id, global_rules, register_rules, overlay_rules, character_rules, sorted(negative), diagnostics, sum(map(len, [global_rules, register_rules, overlay_rules, character_rules])))


def build_prompt_capsule(context: dict[str, Any], active_stack: ActiveStyleStack, max_rules: int = 18, token_budget: int = 1200) -> PromptCapsule:
    classification = _scene_classification_from_dict(context["scene_classification"] if isinstance(context["scene_classification"], dict) else to_plain(context["scene_classification"]))
    focus_character = context.get("focus_character")
    stacks_in = context.get("stacks", [])
    if isinstance(stacks_in, dict):
        stacks = {k: _style_stack_from_dict(v) if isinstance(v, dict) else v for k, v in stacks_in.items()}
    else:
        stacks = {(_style_stack_from_dict(s) if isinstance(s, dict) else s).stack_id: (_style_stack_from_dict(s) if isinstance(s, dict) else s) for s in stacks_in}
    stack_ids = [active_stack.primary_stack_id, *active_stack.overlay_stack_ids]
    merged = [merge_style_stack(stacks[stack_id], classification, focus_character, token_budget) for stack_id in stack_ids if stack_id in stacks]

    def instructions(bucket: str, limit: int) -> list[str]:
        rules = sorted([r for m in merged for r in getattr(m, bucket)], key=lambda r: r.get("priority", 0), reverse=True)
        return [r["instruction"] for r in rules[:limit]]

    negatives = list(dict.fromkeys([rule for m in merged for rule in m.negative_rules] + DEFAULT_NEGATIVE_RULES))[:8]
    fewshots: list[str] = []
    for stack_id in stack_ids:
        fewshots.extend(stacks.get(stack_id, StyleStack(stack_id, stack_id)).fewshot_refs)
    return PromptCapsule(
        active_stack=active_stack.primary_stack_id,
        scene_type=classification.primary_type,
        style_register=classification.style_register,
        secondary_types=classification.secondary_types,
        global_rules=instructions("global_rules", max(2, max_rules - 14)),
        register_rules=instructions("register_rules", min(6, max_rules)),
        overlay_rules=instructions("overlay_rules", min(4, max_rules)),
        character_rules=instructions("character_rules", min(4, max_rules)),
        negative_rules=negatives,
        fewshot_refs=list(dict.fromkeys(fewshots))[:2],
        self_checklist=[
            "primary_type의 style_register가 유지됐는가?",
            "secondary_types는 overlay로만 반영됐는가?",
            "원문 고유명사·사건 구조·특정 장면 사물이 누수되지 않았는가?",
            "문체 규칙 때문에 새 장면의 내용이 훼손되지 않았는가?",
        ],
    )


def _text_metrics(text: str) -> dict[str, float]:
    sentences = split_sentences(text)
    lens = [len(re.sub(r"\s", "", s)) for s in sentences]
    avg = sum(lens) / len(lens) if lens else 0
    short = len([l for l in lens if l <= 20]) / max(1, len(lens))
    long = len([l for l in lens if l >= 60]) / max(1, len(lens))
    paragraphs = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
    return {
        "avg_sentence_len": avg,
        "short_sentence_ratio": short,
        "long_sentence_ratio": long,
        "dialogue_ratio": _dialogue_ratio(text, sentences),
        "sentence_count": len(sentences),
        "paragraph_count": len(paragraphs),
        "comma_per_sentence": len(re.findall(r"[,、，]", text)) / max(1, len(sentences)),
    }


def _instruction_fit(text: str, rules: list[StyleRule]) -> float:
    if not rules:
        return 0.72
    words = set(w.lower() for w in re.findall(r"[가-힣A-Za-z0-9]{2,}", text))
    hits = 0
    for rule in rules:
        if any(w.lower() in words for w in re.findall(r"[가-힣A-Za-z0-9]{2,}", rule.instruction)):
            hits += 1
    return _clamp01(0.55 + min(0.35, hits * 0.05))


def _rhythm_fit(text: str, baseline: dict[str, float]) -> float:
    if not baseline:
        return 0.72
    m = _text_metrics(text)
    diffs: list[float] = []
    if baseline.get("avg_sentence_len"):
        diffs.append(min(1, abs(m["avg_sentence_len"] - baseline["avg_sentence_len"]) / max(10, baseline["avg_sentence_len"])))
    for key in ["short_sentence_ratio", "long_sentence_ratio"]:
        if key in baseline:
            diffs.append(min(1, abs(m[key] - baseline[key])))
    return _clamp01(1 - sum(diffs) / max(1, len(diffs)))


def _discourse_fit(text: str, expected: SceneClassification | None, inferred: SceneClassification) -> float:
    if not expected:
        return 0.7
    expected_functions = set(expected.narrative_functions)
    inferred_functions = set(inferred.narrative_functions)
    coverage = len(expected_functions & inferred_functions) / max(1, len(expected_functions))
    feature_alignment = 0.0
    if "information_reveal" in expected_functions:
        feature_alignment += inferred.feature_scores.exposition_marker_density * 0.35
    if "movement" in expected_functions:
        feature_alignment += inferred.feature_scores.movement_marker_density * 0.35
    if "tension_escalation" in expected_functions:
        feature_alignment += inferred.feature_scores.conflict_intensity * 0.35
    if "relationship_shift" in expected_functions:
        feature_alignment += inferred.feature_scores.relationship_shift_density * 0.35
    if "emotional_shift" in expected_functions:
        feature_alignment += inferred.feature_scores.internal_judgment_density * 0.25
    if "scene_transition" in expected_functions:
        feature_alignment += inferred.feature_scores.transition_marker_density * 0.3
    return _clamp01(0.48 + coverage * 0.32 + min(0.2, feature_alignment))


def _dialogue_fit(inferred: SceneClassification, expected: SceneClassification | None, baseline: dict[str, float]) -> float:
    expected_ratio = baseline.get("dialogue_ratio")
    if expected and expected.style_register == "dialogue":
        return _clamp01(0.45 + inferred.scores["DIA"] * 0.55)
    if isinstance(expected_ratio, (int, float)):
        return _clamp01(1 - min(1, abs(inferred.scores["DIA"] - expected_ratio)))
    return _clamp01(0.82 - max(0.0, inferred.scores["DIA"] - 0.35) * 0.45)


def _lexical_fit(text: str, rules: list[StyleRule], content_terms: list[str]) -> float:
    words = re.findall(r"[가-힣A-Za-z0-9]{2,}", text)
    if not words:
        return 0.2
    unique_ratio = len(set(words)) / len(words)
    rule_words = {
        w.lower()
        for rule in rules
        for w in re.findall(r"[가-힣A-Za-z0-9]{2,}", rule.instruction)
        if len(w) >= 2
    }
    text_words = {w.lower() for w in words}
    rule_contact = len(rule_words & text_words) / max(1, min(len(rule_words), 12))
    leakage_overlap = len([term for term in content_terms if term and term in text])
    return _clamp01(0.42 + min(0.3, unique_ratio * 0.35) + min(0.2, rule_contact * 0.2) - min(0.22, leakage_overlap * 0.04))


def _repeated_ngram_ratio(text: str, n: int = 3) -> float:
    words = re.findall(r"[가-힣A-Za-z0-9]{2,}", text)
    grams = [" ".join(words[i : i + n]) for i in range(max(0, len(words) - n + 1))]
    if not grams:
        return 0.0
    repeated = sum(count - 1 for count in _top_counts(grams, len(grams)).values() if count > 1)
    return repeated / len(grams)


def _fluency_score(text: str) -> float:
    if not text.strip():
        return 0.2
    metrics = _text_metrics(text)
    avg = metrics["avg_sentence_len"]
    punctuation_noise = len(re.findall(r"[!?]{3,}|…{4,}", text))
    balance = 1.0
    if avg < 6 or avg > 95:
        balance -= 0.25
    if metrics["comma_per_sentence"] > 4:
        balance -= 0.15
    balance -= min(0.25, punctuation_noise * 0.05)
    balance -= min(0.3, _repeated_ngram_ratio(text, 2) * 0.9)
    return _clamp01(balance)


def _leakage_hits(text: str, terms: list[str]) -> list[str]:
    return sorted({term for term in terms if term and term in text})


def _overfit_penalty(text: str, leakage_hits: list[str]) -> float:
    repeated_sentence_count = 0
    sentences = split_sentences(text)
    seen: set[str] = set()
    for sentence in sentences:
        normalized = re.sub(r"\s+", "", sentence)
        if normalized in seen:
            repeated_sentence_count += 1
        seen.add(normalized)
    ngram_ratio = _repeated_ngram_ratio(text, 3)
    leakage_repeat = sum(max(0, text.count(term) - 1) for term in leakage_hits)
    return _clamp01(min(0.28, ngram_ratio * 0.6 + repeated_sentence_count * 0.05 + leakage_repeat * 0.025))


def score_style_match(text: str, style_profile: StyleProfile | StylePreset | StyleStack, scene_classification: SceneClassification | None = None) -> StyleMatchReport:
    if isinstance(style_profile, StyleStack):
        global_rules = style_profile.global_rules
        register_rules = style_profile.register_rules
        negative = style_profile.negative_rules
        content_terms = [term for preset in style_profile.presets for term in preset.content_terms]
        baseline = next((p.metrics_baseline for p in style_profile.presets if p.metrics_baseline), {})
        stack_blend_fit = _clamp01(0.62 + min(0.28, len([a for a in style_profile.adapters if a.enabled]) * 0.06))
    else:
        global_rules = style_profile.global_rules
        register_rules = style_profile.register_rules
        negative = style_profile.negative_rules
        content_terms = getattr(style_profile, "content_terms", [])
        baseline = getattr(style_profile, "metrics_baseline", {})
        stack_blend_fit = 0.7
    inferred = classify_scene(text, {"scene_id": scene_classification.scene_id if scene_classification else "S001"})
    active_register_rules = register_rules.get(scene_classification.style_register, []) if scene_classification else []
    global_fit = _instruction_fit(text, global_rules)
    register_fit = _instruction_fit(text, active_register_rules) if scene_classification else 0.7
    scene_fit = 0.7
    if scene_classification:
        scene_fit = 1.0 if inferred.primary_type == scene_classification.primary_type else 0.78 if inferred.style_register == scene_classification.style_register else 0.55
    rhythm = _rhythm_fit(text, baseline)
    dialogue_fit = _dialogue_fit(inferred, scene_classification, baseline)
    leakage_hits = _leakage_hits(text, content_terms)
    leakage = _clamp01(min(0.35, len(leakage_hits) * 0.05))
    register_penalty = 0.0
    if scene_classification and inferred.primary_type != scene_classification.primary_type:
        register_penalty = 0.04 if inferred.style_register == scene_classification.style_register else 0.12
    overfit = _overfit_penalty(text, leakage_hits)
    discourse_fit = _discourse_fit(text, scene_classification, inferred)
    lexical_fit = _lexical_fit(text, [*global_rules, *active_register_rules], content_terms)
    fluency = _fluency_score(text)
    if any(rule and rule in text for rule in negative):
        fluency = _clamp01(fluency - 0.08)
    total = _clamp01(
        global_fit * 0.20 + register_fit * 0.20 + scene_fit * 0.10 + stack_blend_fit * 0.10 + rhythm * 0.12 + discourse_fit * 0.13 + dialogue_fit * 0.08 + lexical_fit * 0.05 + fluency * 0.07 - leakage - register_penalty - overfit
    )
    return StyleMatchReport(
        _id("style_report", text[:120]),
        total,
        global_fit,
        register_fit,
        scene_fit,
        stack_blend_fit,
        rhythm,
        discourse_fit,
        dialogue_fit,
        lexical_fit,
        fluency,
        leakage,
        register_penalty,
        overfit,
        [
            f"inferred_primary={inferred.primary_type}",
            f"expected_primary={scene_classification.primary_type if scene_classification else 'not_provided'}",
            f"leakage_hits={len(leakage_hits)}",
            f"discourse_fit={discourse_fit}",
            f"lexical_fit={lexical_fit}",
            f"fluency={fluency}",
            f"overfit_penalty={overfit}",
        ],
    )


def _md_list(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items) if items else "- (none)"


def _preset_md(preset: StylePreset) -> str:
    sections = [
        f"# {preset.name}",
        "",
        f"- preset_id: {preset.preset_id}",
        f"- type: {preset.preset_type}",
        f"- default_strength: {preset.default_strength}",
        "",
        "## Compact instruction",
        preset.compact_instruction or "(none)",
        "",
        "## Global rules",
        _md_list([r.instruction for r in preset.global_rules]),
        "",
        "## Register rules",
    ]
    for register, rules in preset.register_rules.items():
        sections.extend([f"### {register}", _md_list([r.instruction for r in rules]), ""])
    sections.extend(["## Negative rules", _md_list(preset.negative_rules)])
    return "\n".join(sections)


def _stack_md(stack: StyleStack) -> str:
    return "\n".join([
        f"# {stack.name}",
        "",
        f"- stack_id: {stack.stack_id}",
        f"- conflict_policy: {stack.conflict_policy}",
        f"- max_active_rules: {stack.max_active_rules}",
        "",
        "## Adapters",
        "\n".join(f"- {a.preset_id}: role={a.role}, scope={a.scope}, weight={a.weight}" for a in stack.adapters) or "- (none)",
        "",
        "## Negative rules",
        _md_list(stack.negative_rules),
    ])


def _router_md(router: StyleRouter) -> str:
    rules = sorted([r for r in router.rules if r.enabled], key=_route_sort_key, reverse=True)
    return "\n".join([
        "# Style Router",
        "",
        f"- router_id: {router.router_id}",
        f"- default_stack_id: {router.default_stack_id or 'stack_default'}",
        "",
        "## Priority",
        "manual_override > character_dialogue > dialogue > scene_id > style_register > scene_type > chapter > arc > project_default",
        "",
        "## Rules",
        "\n".join(f"- {r.rule_id}: {r.target_type}={r.target_value} -> {r.stack_id} (priority {r.priority})" for r in rules) or "- (none)",
    ])


def _reference_policy_md() -> str:
    return "\n".join([
        "# Reference Loading Policy",
        "",
        "- Load preset and stack markdown only for the active route.",
        "- Load at most two few-shot references per prompt capsule.",
        f"- Do not load more than {FEWSHOT_MAX_FILES} few-shot files across a single task.",
        f"- Keep total few-shot bytes under {FEWSHOT_MAX_BYTES}.",
        "- Treat source names, proper nouns, object lists, choreography, and event order as content, not style.",
        "- LLM output may explain or suggest changes, but it must not set the authoritative StyleMatchScore.",
    ])


def _regression_fixture_json(project_id: str, presets: list[StylePreset], stacks: list[StyleStack], router: StyleRouter) -> str:
    fixture = {
        "schema_version": "bindery.style.skillpack.regression.v1",
        "project_id": project_id,
        "checks": [
            {
                "name": "dialogue_relationship_overlay",
                "scene_text": "“선생님, 이 자료를 믿어도 됩니까?”\n“아직은요. 그래도 당신 말은 확인하겠습니다.”\n그 호칭은 조금 가까워져 있었다.",
                "expected_primary_type": "DIA",
                "expected_secondary_type": "REL",
                "score_guard": "local_runtime_authoritative",
            },
            {
                "name": "sentence_blocks_grouped",
                "scene_text": "에이라는 말없이 자료를 넘겼다.\n\n그 시선은 서류 아래쪽에서 멈췄다.\n\n주인공은 고개를 끄덕였다.\n\n잠시 뒤 방 안의 공기가 낮게 가라앉았다.",
                "expected_note": "Sentence-separated samples are not one sentence per scene.",
            },
        ],
        "preset_count": len(presets),
        "stack_count": len(stacks),
        "router_rule_count": len(router.rules),
    }
    return json.dumps(fixture, ensure_ascii=False, indent=2)


def _korean_markers_json() -> str:
    return json.dumps(
        {
            "action_verbs": ACTION_VERB_MARKERS,
            "judgment_markers": JUDGMENT_MARKERS,
            "relationship_markers": RELATIONSHIP_MARKERS,
            "emotion_markers": EMOTION_MARKERS,
            "speaker_policy": "speaker_candidates_are_not_authoritative_manual_correction_first",
        },
        ensure_ascii=False,
        indent=2,
    )


def _validator_script() -> str:
    return "\n".join([
        "#!/usr/bin/env python3",
        "from pathlib import Path",
        "import json",
        "import sys",
        "",
        "REQUIRED = [",
        "    'SKILL.md',",
        "    'agents/openai.yaml',",
        "    'references/preset-index.md',",
        "    'references/scene-classification.md',",
        "    'references/style-router.md',",
        "    'references/writing-workflow.md',",
        "    'references/scoring-rubric.md',",
        "    'references/leakage-rules.md',",
        "    'references/reference-policy.md',",
        "    'references/regression-fixture.json',",
        "    'references/structured-output-schemas.json',",
        "    'references/korean-nlp-markers.json',",
        "]",
        "",
        "def main(root):",
        "    root = Path(root)",
        "    errors = [f'missing {rel}' for rel in REQUIRED if not (root / rel).exists()]",
        "    fixture = root / 'references/regression-fixture.json'",
        "    if fixture.exists():",
        "        try:",
        "            json.loads(fixture.read_text(encoding='utf-8'))",
        "        except json.JSONDecodeError as exc:",
        "            errors.append(f'invalid regression fixture: {exc}')",
        "    fewshots = list((root / 'references/fewshots').glob('*')) if (root / 'references/fewshots').exists() else []",
        "    if len([p for p in fewshots if p.is_file()]) > 12:",
        "        errors.append('too many few-shot files')",
        "    total = sum(p.stat().st_size for p in fewshots if p.is_file())",
        "    if total > 120000:",
        "        errors.append('few-shot bytes exceed limit')",
        "    print(json.dumps({'ok': not errors, 'errors': errors, 'fewshot_bytes': total}, ensure_ascii=False, indent=2))",
        "    return 0 if not errors else 1",
        "",
        "if __name__ == '__main__':",
        "    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else '.'))",
    ])


def validate_style_skill_pack(root: Path) -> dict[str, Any]:
    required = [
        "SKILL.md",
        "agents/openai.yaml",
        "references/preset-index.md",
        "references/scene-classification.md",
        "references/style-router.md",
        "references/writing-workflow.md",
        "references/scoring-rubric.md",
        "references/leakage-rules.md",
        "references/reference-policy.md",
        "references/regression-fixture.json",
        "references/structured-output-schemas.json",
        "references/korean-nlp-markers.json",
    ]
    errors = [f"missing {rel}" for rel in required if not (root / rel).exists()]
    warnings: list[str] = []
    fixture_path = root / "references/regression-fixture.json"
    if fixture_path.exists():
        try:
            fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
            if not fixture.get("checks"):
                errors.append("regression fixture has no checks")
        except json.JSONDecodeError as exc:
            errors.append(f"invalid regression fixture: {exc}")
    fewshot_files = [p for p in (root / "references/fewshots").glob("*") if p.is_file()] if (root / "references/fewshots").exists() else []
    fewshot_bytes = sum(p.stat().st_size for p in fewshot_files)
    if len(fewshot_files) > FEWSHOT_MAX_FILES:
        errors.append(f"few-shot file count exceeds {FEWSHOT_MAX_FILES}")
    if fewshot_bytes > FEWSHOT_MAX_BYTES:
        errors.append(f"few-shot bytes exceed {FEWSHOT_MAX_BYTES}")
    if not list((root / "references/presets").glob("*.md")):
        warnings.append("no preset markdown files")
    if not list((root / "references/stacks").glob("*.md")):
        warnings.append("no stack markdown files")
    return {
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "counts": {
            "files": len([p for p in root.rglob("*") if p.is_file()]),
            "fewshot_files": len(fewshot_files),
            "fewshot_bytes": fewshot_bytes,
        },
    }


def zip_style_skill_pack(root: Path, zip_path: Path | None = None) -> Path:
    zip_path = zip_path or root.with_suffix(".zip")
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(root.rglob("*")):
            if not path.is_file() or path == zip_path:
                continue
            zf.write(path, path.relative_to(root.parent))
    return zip_path


def export_style_skill_pack(project_id: str, presets: list[StylePreset], stacks: list[StyleStack], router: StyleRouter, output_dir: Path, zip_path: Path | None = None) -> Path:
    root = output_dir / "bindery-style-runtime"
    (root / "agents").mkdir(parents=True, exist_ok=True)
    for rel in ["references/presets", "references/stacks", "references/fewshots", "scripts"]:
        (root / rel).mkdir(parents=True, exist_ok=True)
    files: dict[str, str] = {
        "SKILL.md": "\n".join([
            "---",
            "name: bindery-style-runtime",
            "description: apply bindery style presets, style stacks, scene classification, style routing, prompt capsules, scoring, and leakage checks for Korean fiction drafting.",
            "---",
            "",
            "# Bindery Style Runtime",
            "",
            "Use saved style presets as reusable writing adapters. Apply abstract style rules only; do not imitate source text directly.",
            "",
            "## Workflow",
            "1. Load `references/preset-index.md`.",
            "2. Classify the scene with `references/scene-classification.md` when no scene type is given.",
            "3. Resolve the active stack with `references/style-router.md`.",
            "4. Build a compact Style Capsule from active stack, scene register, overlays, character rules, negative rules, and at most two few-shot references.",
            "5. Run leakage, register, and scene-classification checks before final output.",
        ]),
        "agents/openai.yaml": "name: bindery-style-runtime\nversion: 1\n",
        "references/preset-index.md": "\n".join(["# Preset Index", "", f"Project: {project_id}", "", *[f"- {p.preset_id}: {p.name} ({p.preset_type})" for p in presets]]),
        "references/scene-classification.md": "\n".join([
            "# Scene Classification",
            "",
            "Tags: OBS observation, DIA dialogue, ACT action, INF information, CON conflict, MOV movement, AFT aftermath, TRN transition, INT internal overlay, REL relationship overlay.",
            "",
            "Primary type chooses the main style_register. Secondary types are overlays only and must not overwrite the primary register.",
            "",
            "Feature scores: dialogue_ratio, observation_density, action_verb_density, exposition_marker_density, conflict_intensity, movement_marker_density, aftermath_marker_density, transition_marker_density, internal_judgment_density, relationship_shift_density.",
        ]),
        "references/style-router.md": _router_md(router),
        "references/writing-workflow.md": "# Writing Workflow\n\nBuild PromptCapsule, draft or rewrite, then check leakage and register mismatch. Preserve new user content unless rewrite strength is strong.\n",
        "references/scoring-rubric.md": "# Scoring Rubric\n\nStyleMatchScore = GlobalFit*0.20 + RegisterFit*0.20 + SceneClassificationFit*0.10 + StackBlendFit*0.10 + RhythmFit*0.12 + DiscourseFit*0.13 + DialogueFit*0.08 + LexicalFit*0.05 + Fluency*0.07 - ContentLeakagePenalty - RegisterMismatchPenalty - OverfitPenalty.\n",
        "references/leakage-rules.md": "# Leakage Rules\n\n" + _md_list(DEFAULT_NEGATIVE_RULES) + "\n",
        "references/reference-policy.md": _reference_policy_md(),
        "references/regression-fixture.json": _regression_fixture_json(project_id, presets, stacks, router),
        "references/structured-output-schemas.json": json.dumps(STRUCTURED_OUTPUT_SCHEMAS, ensure_ascii=False, indent=2),
        "references/korean-nlp-markers.json": _korean_markers_json(),
        "scripts/validate_skill_pack.py": _validator_script(),
    }
    for preset in presets:
        files[f"references/presets/{preset.preset_id}.md"] = _preset_md(preset)
    for stack in stacks:
        files[f"references/stacks/{stack.stack_id}.md"] = _stack_md(stack)
    for rel, content in files.items():
        target = root / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    validation = validate_style_skill_pack(root)
    (root / "validation-report.json").write_text(json.dumps(validation, ensure_ascii=False, indent=2), encoding="utf-8")
    if zip_path:
        zip_style_skill_pack(root, zip_path)
    return root


def _rule_from_dict(raw: dict[str, Any]) -> StyleRule:
    return StyleRule(raw.get("rule_id") or raw.get("ruleId") or _id("rule", raw.get("instruction", "")), raw.get("instruction", ""), raw.get("axis", ""), float(raw.get("strength", 1)), raw.get("source", "manual"))


def _rules_from_dict(items: list[dict[str, Any]] | None) -> list[StyleRule]:
    return [_rule_from_dict(x) for x in (items or [])]


def _rules_map(raw: dict[str, list[dict[str, Any]]] | None) -> dict[str, list[StyleRule]]:
    return {k: _rules_from_dict(v) for k, v in (raw or {}).items()}


def _preset_from_dict(raw: dict[str, Any]) -> StylePreset:
    return StylePreset(
        preset_id=raw["preset_id"],
        name=raw.get("name", raw["preset_id"]),
        preset_type=raw.get("preset_type", "mixed"),
        default_strength=float(raw.get("default_strength", 0.75)),
        description=raw.get("description", ""),
        project_id=raw.get("project_id"),
        source_profile_id=raw.get("source_profile_id"),
        allowed_scopes=raw.get("allowed_scopes", ["project", "chapter", "scene", "dialogue", "character"]),
        style_axes=raw.get("style_axes", {}),
        register_availability=raw.get("register_availability", {}),
        compact_instruction=raw.get("compact_instruction", ""),
        global_rules=_rules_from_dict(raw.get("global_rules")),
        register_rules=_rules_map(raw.get("register_rules")),
        overlay_rules=_rules_map(raw.get("overlay_rules")),
        character_rules=_rules_map(raw.get("character_rules")),
        negative_rules=raw.get("negative_rules", []),
        fewshot_refs=raw.get("fewshot_refs", []),
        content_terms=raw.get("content_terms", []),
        metrics_baseline=raw.get("metrics_baseline", {}),
    )


def _adapter_from_dict(raw: dict[str, Any]) -> StyleStackAdapter:
    return StyleStackAdapter(raw["preset_id"], raw.get("role", "base"), float(raw.get("weight", 1)), raw.get("scope", "global"), bool(raw.get("enabled", True)), raw.get("compatible_scene_types", []), raw.get("compatible_registers", []), _rules_from_dict(raw.get("rule_overrides")))


def _style_stack_from_dict(raw: dict[str, Any]) -> StyleStack:
    return StyleStack(
        stack_id=raw["stack_id"],
        name=raw.get("name", raw["stack_id"]),
        adapters=[_adapter_from_dict(x) for x in raw.get("adapters", [])],
        description=raw.get("description", ""),
        project_id=raw.get("project_id"),
        base_preset_id=raw.get("base_preset_id"),
        presets=[_preset_from_dict(x) for x in raw.get("presets", [])],
        conflict_policy=raw.get("conflict_policy", "scope_priority"),
        normalization=raw.get("normalization", "weighted_average"),
        max_active_rules=int(raw.get("max_active_rules", 18)),
        global_rules=_rules_from_dict(raw.get("global_rules")),
        register_rules=_rules_map(raw.get("register_rules")),
        overlay_rules=_rules_map(raw.get("overlay_rules")),
        character_rules=_rules_map(raw.get("character_rules")),
        negative_rules=raw.get("negative_rules", []),
        fewshot_refs=raw.get("fewshot_refs", []),
    )


def _scene_classification_from_dict(raw: dict[str, Any]) -> SceneClassification:
    return SceneClassification(
        raw.get("scene_id", "S001"),
        raw.get("chapter_id"),
        raw.get("primary_type", "OBS"),
        raw.get("secondary_types", []),
        raw.get("surface_mode", "mixed"),
        raw.get("narrative_functions", []),
        raw.get("style_register", STYLE_REGISTER_BY_TAG.get(raw.get("primary_type", "OBS"), "observation")),
        float(raw.get("confidence", 0.5)),
        raw.get("scores", {tag: 0 for tag in ALL_SCENE_TAGS}),
        SceneFeatureScores(**raw.get("feature_scores", {})),
        bool(raw.get("manual_override", False)),
    )


def _router_rule_from_dict(raw: dict[str, Any]) -> StyleRouterRule:
    return StyleRouterRule(raw.get("rule_id", _id("route")), raw["target_type"], raw.get("target_value", "*"), raw["stack_id"], int(raw.get("priority", 0)), bool(raw.get("enabled", True)), bool(raw.get("overlay", True)), raw.get("compatible_scene_types", []), raw.get("compatible_registers", []))


def _router_from_dict(raw: dict[str, Any]) -> StyleRouter:
    return StyleRouter(raw.get("router_id", "router_default"), [_router_rule_from_dict(x) for x in raw.get("rules", [])], raw.get("project_id"), raw.get("default_stack_id"))


def load_style_payload(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))
