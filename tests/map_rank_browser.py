"""Playwright regression test for map-assisted ranking exclusion (no network required)."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1] / 'public'
html = (ROOT / 'index.html').read_text(encoding='utf-8')
board = (ROOT / 'leaderboard.js').read_text(encoding='utf-8')
assert html.count('<script src="./leaderboard.js"></script>') == 1
html = html.replace('<script src="./leaderboard.js"></script>', '<script>'+board+'</script>')
html = html.replace('<link rel="stylesheet" href="./leaderboard.css" />', '')

def state(page):
    return page.evaluate('window.RetroLeaderboard.getState()')

def complete(page):
    page.evaluate('''() => { stagePhase='playing'; stopped=false; elapsed=18; stageHits=0; assistedStage=false; autoplay=false; win(); }''')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width':1360,'height':950})
    errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content(html, wait_until='domcontentloaded', timeout=30000)
    page.wait_for_function('window.RetroLeaderboard && typeof toggleMap === "function"', timeout=10000)
    assert state(page)['runEligible'] is True

    # Tab opens the map and marks the entire run as ineligible, also after closing.
    page.evaluate("document.body.setAttribute('tabindex','-1');document.body.focus()")
    page.keyboard.press('Tab')
    assert page.evaluate('mapOpen') is True
    assert state(page)['runEligible'] is False
    page.evaluate("document.body.focus()")
    page.keyboard.press('Tab')
    assert page.evaluate('mapOpen') is False
    assert state(page)['runEligible'] is False
    complete(page)
    assert state(page)['bestEligible'] is None
    assert state(page)['localEntries'] == []

    # Starting fresh clears the map and restores ranking eligibility.
    page.evaluate('newGame()')
    assert page.evaluate('mapOpen') is False
    assert state(page)['runEligible'] is True
    complete(page)
    assert state(page)['bestEligible'] is not None
    assert len(state(page)['localEntries']) == 1

    # Desktop map button disqualifies only subsequent clears, keeping earlier legit records.
    page.evaluate('newGame()')
    page.locator('#mapToggle').click()
    assert page.evaluate('mapOpen') is True
    assert state(page)['runEligible'] is False
    page.locator('#mapToggle').click()
    complete(page)
    assert state(page)['bestEligible'] is None
    assert len(state(page)['localEntries']) == 1

    # Touch map button follows exactly the same logic.
    page.evaluate('newGame()')
    page.evaluate("document.getElementById('touchMap').click()")
    assert state(page)['runEligible'] is False
    complete(page)
    assert state(page)['bestEligible'] is None
    assert len(state(page)['localEntries']) == 1

    # Tab while typing in nickname field must not count as revealing the game map.
    page.evaluate('newGame()')
    page.locator('#rankNickname').focus()
    page.keyboard.press('Tab')
    assert page.evaluate('mapOpen') is False
    assert state(page)['runEligible'] is True

    # Map seen before starting the stage also counts as assisted.
    page.evaluate('newGame()')
    page.locator('#mapToggle').click()
    assert page.evaluate('stopped') is True
    assert state(page)['runEligible'] is False

    assert not errors, errors
    browser.close()
print('MAP RANKING BROWSER PASS: tab, toolbar, touch, closing, new game, records, focus')
