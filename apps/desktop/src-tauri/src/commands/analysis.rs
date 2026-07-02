use super::path_utils::resolve_existing;
use crate::error::AppResult;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;

#[derive(Serialize, Clone)]
pub struct TermStat {
    pub term: String,
    pub count: usize,
    pub positions: Vec<usize>,
    pub judgment: String,
}
#[derive(Serialize, Clone)]
pub struct RepetitionReport {
    pub path: String,
    pub terms: Vec<TermStat>,
}

pub fn repetition_from_text(path: String, text: &str) -> RepetitionReport {
    let watch = [
        "시선",
        "침묵",
        "숨",
        "어깨",
        "고개",
        "미소",
        "눈빛",
        "공기",
        "순간",
        "말없이",
        "입을 열었다",
        "고개를 끄덕였다",
    ];
    let mut map: HashMap<String, (usize, Vec<usize>)> = HashMap::new();
    for term in watch {
        let mut start = 0;
        while let Some(pos) = text[start..].find(term) {
            let abs = start + pos;
            let e = map.entry(term.to_string()).or_insert((0, vec![]));
            e.0 += 1;
            e.1.push(abs);
            start = abs + term.len();
        }
    }
    for (idx, tok) in text
        .split(|c: char| !c.is_alphanumeric() && c != '_')
        .enumerate()
    {
        let t = tok.trim();
        if t.chars().count() >= 2 {
            let e = map.entry(t.to_string()).or_insert((0, vec![]));
            e.0 += 1;
            if e.1.len() < 20 {
                e.1.push(idx);
            }
        }
    }
    let mut terms: Vec<TermStat> = map
        .into_iter()
        .filter(|(_, (c, _))| *c >= 2)
        .map(|(term, (count, positions))| {
            let judgment = if count >= 8 {
                "overused"
            } else if count >= 4 {
                "watch"
            } else {
                "ok"
            };
            TermStat {
                term,
                count,
                positions,
                judgment: judgment.into(),
            }
        })
        .collect();
    terms.sort_by(|a, b| b.count.cmp(&a.count).then(a.term.cmp(&b.term)));
    terms.truncate(40);
    RepetitionReport { path, terms }
}

#[tauri::command]
pub fn analyze_repetition(
    project_path: String,
    relative_path: String,
) -> AppResult<RepetitionReport> {
    let path = resolve_existing(&project_path, &relative_path)?;
    let text = fs::read_to_string(&path)?;
    Ok(repetition_from_text(relative_path, &text))
}
