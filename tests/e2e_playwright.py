from playwright.sync_api import sync_playwright
import time
import os
import shutil
CHROME=os.environ.get('CHROME_PATH')
if not CHROME:
    CHROME = shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
BASE=os.environ.get('PREVIEW_URL','http://127.0.0.1:4173/')
S=os.environ.get('SHOT_DIR','/tmp/ns-shots')
os.makedirs(S,exist_ok=True)
results=[]
def check(n,c): results.append((n,bool(c))); print(('PASS' if c else 'FAIL'),n)
with sync_playwright() as p:

    launch_options={'headless': True, 'args': ['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']}
    if CHROME:
        launch_options['executable_path']=CHROME
    b=p.chromium.launch(**launch_options)
    pg=b.new_page(viewport={'width':1600,'height':1000})
    errs=[]
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto(BASE,wait_until='networkidle',timeout=20000); time.sleep(1)

    # default LIGHT theme
    theme=pg.evaluate("document.documentElement.dataset.theme")
    check('default theme is light', theme=='light')

    pg.click('button:has-text("프로젝트 열기")'); time.sleep(1.3)
    check('project chip replaces open form', pg.locator('.proj').count()>0)
    pg.click('.file-node:has-text("manuscript.md")'); time.sleep(0.9)
    check('editor mounted', pg.locator('.cm-editor').count()>0)
    check('AI tab default in dock', pg.locator('.step-main').count()>=6)
    pg.screenshot(path=f'{S}/01_light_editor_ai.png')

    # prompt preview (roadmap)
    pg.locator('.step-eye').nth(1).click(); time.sleep(0.5)  # Draft preview
    check('prompt preview opens', pg.locator('.pv').count()>0)
    check('prompt contains codex/meta', 'Codex' in pg.locator('.pv-body').inner_text())
    pg.screenshot(path=f'{S}/02_prompt_preview.png')
    pg.click('.pv-head button:has-text("닫기")'); time.sleep(0.3)

    # Analyze + QA from AI tab
    pg.click('.step-main:has-text("Analyze")'); time.sleep(0.9)
    check('repetition decorations', pg.locator('.cm-rep-over,.cm-rep-watch').count()>0)
    pg.click('.step-main:has-text("QA")'); time.sleep(0.9)
    check('auto-switch to 검토 tab with gates', pg.locator('.gate').count()>0)
    pg.screenshot(path=f'{S}/03_light_evidence.png')

    # Draft → diff
    pg.click('.dtab:has-text("AI")'); time.sleep(0.3)
    pg.click('.step-main:has-text("Draft")'); time.sleep(1.3)
    check('diff hunks', pg.locator('.hunk').count()>0)
    pg.screenshot(path=f'{S}/04_light_diff.png')
    pg.click('.cs:has-text("Editor")'); time.sleep(0.4)

    # Codex + progressions (roadmap)
    pg.click('.dtab:has-text("설정집")'); time.sleep(0.4)
    check('progressions present', pg.locator('.prog').count()>0)
    pg.locator('.prog summary').first.click(); time.sleep(0.3)
    check('progression rows visible', pg.locator('.prog-row').count()>0)
    pg.click('.codex-wrap button:has-text("Scan")'); time.sleep(0.9)
    check('mentions + link insert btn', pg.locator('.m-link').count()>0)
    pg.screenshot(path=f'{S}/05_light_codex.png')

    # Plot
    pg.click('.dtab:has-text("플롯")'); time.sleep(0.5)
    check('plot grid', pg.locator('table').count()>0)
    pg.screenshot(path=f'{S}/06_light_plot.png')

    # editor overflow menu: focus + zen
    pg.click('.more-wrap .icon'); time.sleep(0.3)
    check('overflow menu opens', pg.locator('.menu').count()>0)
    pg.click('.menu button:has-text("포커스 모드")'); time.sleep(0.5)
    check('focus dim on', pg.locator('.cm-focus-dim').count()>0)
    pg.click('.menu button:has-text("집중(Zen) 모드")'); time.sleep(0.5)
    check('zen hides dock', pg.locator('.dock').count()==0)
    pg.screenshot(path=f'{S}/07_light_zen.png')
    # exit zen via menu again
    pg.click('.more-wrap .icon'); time.sleep(0.3)
    pg.click('.menu button:has-text("집중(Zen) 모드")'); time.sleep(0.4)

    # smart quotes (뮤블식): typing " yields curly pair
    pg.click('.cm-content'); pg.keyboard.press('End')
    pg.keyboard.type('"'); time.sleep(0.2)
    body=pg.locator('.cm-content').inner_text()
    check('smart quote pair inserted', '\u201c' in body and '\u201d' in body)
    pg.keyboard.type('테스트'); pg.keyboard.press('Enter'); time.sleep(0.2)

    # theme toggle → dark
    pg.click('.topbar-right .icon'); time.sleep(0.5)
    check('dark theme applied', pg.evaluate("document.documentElement.dataset.theme")=='dark')
    pg.screenshot(path=f'{S}/08_dark_editor.png')
    pg.click('.dtab:has-text("검토")'); time.sleep(0.4)
    pg.screenshot(path=f'{S}/09_dark_evidence.png')

    # palette still works
    pg.keyboard.press('Control+k'); time.sleep(0.4)
    check('palette opens', pg.locator('.cp').count()>0)
    pg.screenshot(path=f'{S}/10_palette.png')
    pg.keyboard.press('Escape')
    b.close()
print('--- errors ---')
for e in errs[:12]: print(' ERR:',e)
print('total errors:',len(errs))
passed=sum(1 for _,o in results if o)
print(f'{passed}/{len(results)} passed')
import sys
sys.exit(0 if passed==len(results) and len(errs)==0 else 1)
