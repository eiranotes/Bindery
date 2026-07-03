CREATE TABLE IF NOT EXISTS style_profiles (
  profile_id TEXT PRIMARY KEY,
  project_id TEXT,
  source_title TEXT,
  language TEXT,
  profile_json TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS style_presets (
  preset_id TEXT PRIMARY KEY,
  project_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  source_profile_id TEXT,
  preset_type TEXT,
  default_strength REAL,
  preset_json TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS style_stacks (
  stack_id TEXT PRIMARY KEY,
  project_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  stack_json TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS scene_classifications (
  scene_id TEXT PRIMARY KEY,
  project_id TEXT,
  chapter_id TEXT,
  primary_type TEXT,
  secondary_types_json TEXT,
  surface_mode TEXT,
  narrative_functions_json TEXT,
  style_register TEXT,
  confidence REAL,
  classification_json TEXT NOT NULL,
  manual_override INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS style_router_rules (
  rule_id TEXT PRIMARY KEY,
  project_id TEXT,
  router_id TEXT,
  target_type TEXT,
  target_value TEXT,
  stack_id TEXT,
  priority INTEGER,
  rule_json TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS style_match_reports (
  report_id TEXT PRIMARY KEY,
  project_id TEXT,
  target_text_id TEXT,
  stack_id TEXT,
  total_score REAL,
  report_json TEXT NOT NULL,
  created_at TEXT
);
