import json
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "packages" / "novelctl-core"))

from novelctl.style_system import (  # noqa: E402
    ActiveStyleStack,
    SQLITE_SCHEMA,
    SceneClassification,
    StylePreset,
    StyleRouteContext,
    StyleRouter,
    StyleRouterRule,
    StyleRule,
    StyleStack,
    StyleStackAdapter,
    STRUCTURED_OUTPUT_SCHEMAS,
    analyze_korean_surface,
    build_prompt_capsule,
    classify_scene,
    export_style_skill_pack,
    merge_style_stack,
    resolve_active_style_stack,
    score_style_match,
    sync_style_repository,
    to_plain,
    validate_style_skill_pack,
    zip_style_skill_pack,
)


def rule(rule_id: str, text: str, axis: str = "test") -> StyleRule:
    return StyleRule(rule_id, text, axis=axis, strength=0.8)


def dialogue_scene() -> str:
    return "\n".join([
        "“선생님, 이 자료를 믿어도 됩니까?”",
        "에이라는 대답하지 않고 표의 끝을 보았다.",
        "“아직은요. 그래도 당신 말은 확인하겠습니다.”",
        "그 호칭은 조금 가까워져 있었다.",
    ])


class SceneClassifierTests(unittest.TestCase):
    def test_dialogue_heavy_scene_gets_dia_primary(self):
        cls = classify_scene(dialogue_scene(), {"scene_id": "S012", "chapter_id": "CH008"})
        self.assertEqual(cls.primary_type, "DIA")
        self.assertEqual(cls.style_register, "dialogue")

    def test_relationship_signal_stays_secondary_when_dialogue_is_central(self):
        cls = classify_scene(dialogue_scene(), {"scene_id": "S013"})
        self.assertEqual(cls.primary_type, "DIA")
        self.assertIn("REL", cls.secondary_types)
        self.assertNotEqual(cls.primary_type, "REL")

    def test_observation_heavy_scene_gets_obs_primary(self):
        text = "문틈으로 희미한 빛이 들어왔다. 바닥의 그림자는 차갑고 선명했다. 창과 벽 사이에 조용한 공기가 고였다."
        cls = classify_scene(text, {"scene_id": "S014"})
        self.assertEqual(cls.primary_type, "OBS")
        self.assertEqual(cls.surface_mode, "description-heavy")

    def test_conflict_signal_becomes_primary_or_secondary(self):
        text = "그때 비명이 터졌다. 누군가 문을 밀고 들어와 공격했다. 위험하다는 말이 끝나기 전에 피가 바닥에 번졌다."
        cls = classify_scene(text, {"scene_id": "S015"})
        self.assertIn("CON", [cls.primary_type, *cls.secondary_types])

    def test_secondary_never_overwrites_primary(self):
        cls = classify_scene(dialogue_scene(), {"scene_id": "S016"})
        self.assertNotIn(cls.primary_type, cls.secondary_types)


class RouterTests(unittest.TestCase):
    def setUp(self):
        self.cls = classify_scene(dialogue_scene(), {"scene_id": "S020", "chapter_id": "CH002"})
        self.router = StyleRouter(
            router_id="router_test",
            default_stack_id="stack_default",
            rules=[
                StyleRouterRule("r_dialogue", "dialogue", "*", "stack_dialogue", priority=10, compatible_registers=["dialogue"]),
                StyleRouterRule("r_char", "character_dialogue", "eira", "stack_eira", priority=1),
                StyleRouterRule("r_conflict", "scene_type", "CON", "stack_conflict", priority=50, compatible_scene_types=["CON"]),
                StyleRouterRule("r_register", "style_register", "dialogue", "stack_register_dialogue", priority=5, compatible_registers=["dialogue"]),
            ],
        )

    def test_character_dialogue_beats_dialogue_rule(self):
        ctx = StyleRouteContext(scene_id="S020", chapter_id="CH002", character_id="eira", dialogue_speakers=["eira"], classification=self.cls)
        active = resolve_active_style_stack(ctx, self.router)
        self.assertEqual(active.primary_stack_id, "stack_eira")
        self.assertIn("stack_dialogue", active.overlay_stack_ids)

    def test_manual_override_beats_everything(self):
        ctx = StyleRouteContext(scene_id="S020", character_id="eira", classification=self.cls, manual_override_stack_id="stack_manual")
        active = resolve_active_style_stack(ctx, self.router)
        self.assertEqual(active.primary_stack_id, "stack_manual")
        self.assertEqual(active.overlay_stack_ids, [])

    def test_style_register_rule_matches(self):
        router = StyleRouter("router_register", rules=[StyleRouterRule("r", "style_register", "dialogue", "stack_dialogue_register", 1)])
        ctx = StyleRouteContext(scene_id="S020", classification=self.cls)
        active = resolve_active_style_stack(ctx, router)
        self.assertEqual(active.primary_stack_id, "stack_dialogue_register")

    def test_overlay_requires_compatibility(self):
        router = StyleRouter(
            "router_incompatible",
            rules=[
                StyleRouterRule("r_char", "character_dialogue", "eira", "stack_eira", 1),
                StyleRouterRule("r_obs", "project_default", "*", "stack_obs", 100, compatible_scene_types=["OBS"]),
            ],
        )
        ctx = StyleRouteContext(scene_id="S020", character_id="eira", dialogue_speakers=["eira"], classification=self.cls)
        active = resolve_active_style_stack(ctx, router)
        self.assertEqual(active.primary_stack_id, "stack_eira")
        self.assertNotIn("stack_obs", active.overlay_stack_ids)


class PromptCapsuleTests(unittest.TestCase):
    def setUp(self):
        self.cls = classify_scene(dialogue_scene(), {"scene_id": "S030"})
        self.preset = StylePreset(
            preset_id="preset_base",
            name="기본 문체",
            global_rules=[rule("g1", "감정 해설보다 관찰과 판단을 먼저 둔다.")],
            register_rules={"dialogue": [rule("d1", "질문과 답변은 짧게 유지한다.")]},
            overlay_rules={"REL": [rule("rel1", "말의 내용보다 거리 변화가 보이게 한다.")]},
            character_rules={"eira": [rule("c1", "에이라는 확인형 반응을 우선한다.")]},
            negative_rules=["설정 설명을 대사로 몰아넣지 않는다."],
            fewshot_refs=["fs_dialogue_001", "fs_rel_001", "fs_extra"],
        )
        self.stack = StyleStack(
            stack_id="stack_base",
            name="기본 스택",
            adapters=[StyleStackAdapter("preset_base", "base", 0.8, "global")],
            presets=[self.preset],
            max_active_rules=4,
            fewshot_refs=["fs_stack_001"],
        )

    def test_merge_and_capsule_rule_buckets(self):
        merged = merge_style_stack(self.stack, self.cls, "eira", token_budget=1200)
        self.assertTrue(merged.global_rules)
        self.assertTrue(merged.register_rules)
        self.assertTrue(merged.overlay_rules)
        self.assertTrue(merged.character_rules)
        self.assertLessEqual(merged.active_rule_count, self.stack.max_active_rules)

        active = ActiveStyleStack("stack_base", [], [], "test")
        capsule = build_prompt_capsule({"scene_id": "S030", "scene_classification": self.cls, "focus_character": "eira", "stacks": [self.stack]}, active, max_rules=4)
        self.assertTrue(capsule.global_rules)
        self.assertTrue(capsule.register_rules)
        self.assertTrue(capsule.overlay_rules)
        self.assertTrue(capsule.character_rules)
        self.assertTrue(capsule.negative_rules)
        self.assertLessEqual(len(capsule.fewshot_refs), 2)

    def test_score_style_match_minimum_fields(self):
        report = score_style_match(dialogue_scene(), self.stack, self.cls)
        self.assertGreaterEqual(report.total_score, 0)
        self.assertLessEqual(report.total_score, 1)
        self.assertIsInstance(report.diagnostics, list)
        self.assertTrue(any("discourse_fit=" in item for item in report.diagnostics))
        self.assertGreaterEqual(report.fluency, 0)


class RepositoryAndNlpTests(unittest.TestCase):
    def test_style_repository_sync_indexes_project_json(self):
        tmp = Path(tempfile.mkdtemp())
        try:
            (tmp / "styles/presets").mkdir(parents=True)
            (tmp / "styles/stacks").mkdir(parents=True)
            (tmp / "styles/routers").mkdir(parents=True)
            (tmp / "styles/classifications").mkdir(parents=True)
            (tmp / "styles/reports").mkdir(parents=True)
            (tmp / "styles/presets/preset_001.json").write_text(json.dumps({"preset_id": "preset_001", "name": "Preset", "preset_type": "mixed"}), encoding="utf-8")
            (tmp / "styles/stacks/stack_001.json").write_text(json.dumps({"stack_id": "stack_001", "name": "Stack"}), encoding="utf-8")
            (tmp / "styles/routers/router.json").write_text(json.dumps({"router_id": "router_001", "rules": [{"rule_id": "route_001", "target_type": "project_default", "target_value": "*", "stack_id": "stack_001"}]}), encoding="utf-8")
            (tmp / "styles/classifications/S001.json").write_text(json.dumps(to_plain(classify_scene(dialogue_scene(), {"scene_id": "S001"}))), encoding="utf-8")
            (tmp / "styles/reports/report_001.json").write_text(json.dumps({"report_id": "report_001", "total_score": 0.8, "stack_id": "stack_001"}), encoding="utf-8")
            summary = sync_style_repository(tmp)
            self.assertTrue(Path(summary["db_path"]).exists())
            self.assertEqual(summary["counts"]["presets"], 1)
            self.assertEqual(summary["counts"]["router_rules"], 1)
            self.assertTrue((tmp / "styles/style-repository.json").exists())
        finally:
            shutil.rmtree(tmp)

    def test_korean_surface_report_marks_manual_speaker_policy(self):
        report = analyze_korean_surface(dialogue_scene(), ["에이라"])
        self.assertTrue(report["dialogue"]["manual_speaker_correction_first"])
        self.assertGreater(report["dialogue"]["quoted_block_count"], 0)
        self.assertTrue(report["relationship_markers"])
        self.assertIn("scene_classification", STRUCTURED_OUTPUT_SCHEMAS)


class SkillPackExportTests(unittest.TestCase):
    def test_sqlite_schema_loaded_from_migration_file(self):
        migration = ROOT / "packages" / "novelctl-core" / "novelctl" / "migrations" / "001_style_system.sql"
        self.assertEqual(SQLITE_SCHEMA, migration.read_text(encoding="utf-8").strip())

    def test_skillpack_files_created(self):
        tmp = Path(tempfile.mkdtemp())
        try:
            preset = StylePreset(preset_id="preset_001", name="테스트 프리셋", global_rules=[rule("g1", "전역 규칙")])
            stack = StyleStack(stack_id="stack_001", name="테스트 스택", adapters=[StyleStackAdapter("preset_001", "base", 0.7, "global")], presets=[preset])
            router = StyleRouter("router_001", rules=[StyleRouterRule("route_001", "project_default", "*", "stack_001", 1)])
            root = export_style_skill_pack("proj", [preset], [stack], router, tmp)
            required = [
                "SKILL.md",
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
                "scripts/validate_skill_pack.py",
                "validation-report.json",
                "references/presets/preset_001.md",
                "references/stacks/stack_001.md",
            ]
            for rel in required:
                self.assertTrue((root / rel).exists(), rel)
            validation = validate_style_skill_pack(root)
            self.assertTrue(validation["ok"], validation)
            zip_path = zip_style_skill_pack(root, tmp / "style-runtime.zip")
            self.assertTrue(zip_path.exists())
            with zipfile.ZipFile(zip_path) as zf:
                self.assertIn("bindery-style-runtime/SKILL.md", zf.namelist())
        finally:
            shutil.rmtree(tmp)

    def test_cli_style_classify(self):
        cmd = [sys.executable, str(ROOT / "packages" / "novelctl-core" / "novelctl" / "cli.py"), "style-classify", str(ROOT), "--text", dialogue_scene(), "--json"]
        result = subprocess.run(cmd, text=True, capture_output=True, check=True)
        data = json.loads(result.stdout)
        self.assertTrue(data["ok"])
        self.assertEqual(data["data"]["primary_type"], "DIA")

    def test_cli_style_sql_reads_migration(self):
        cmd = [sys.executable, str(ROOT / "packages" / "novelctl-core" / "novelctl" / "cli.py"), "style-sql", str(ROOT), "--json"]
        result = subprocess.run(cmd, text=True, capture_output=True, check=True)
        data = json.loads(result.stdout)
        self.assertTrue(data["ok"])
        self.assertIn("CREATE TABLE IF NOT EXISTS style_profiles", data["data"]["schema"])

    def test_cli_structured_schema_and_korean_nlp(self):
        schema_cmd = [sys.executable, str(ROOT / "packages" / "novelctl-core" / "novelctl" / "cli.py"), "style-structured-schemas", str(ROOT), "--json"]
        schema_result = subprocess.run(schema_cmd, text=True, capture_output=True, check=True)
        schema_data = json.loads(schema_result.stdout)
        self.assertIn("scoring_explanation", schema_data["data"]["schemas"])
        nlp_cmd = [sys.executable, str(ROOT / "packages" / "novelctl-core" / "novelctl" / "cli.py"), "style-korean-nlp", str(ROOT), "--text", dialogue_scene(), "--speaker", "에이라", "--json"]
        nlp_result = subprocess.run(nlp_cmd, text=True, capture_output=True, check=True)
        nlp_data = json.loads(nlp_result.stdout)
        self.assertTrue(nlp_data["data"]["dialogue"]["manual_speaker_correction_first"])


if __name__ == "__main__":
    unittest.main()
