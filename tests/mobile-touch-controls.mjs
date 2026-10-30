import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

test('touch D-pad uses accessible SVG icons, not selectable text glyphs', () => {
  for (const direction of ['forward', 'back', 'left', 'right']) {
    assert.match(html, new RegExp('<button type="button" data-control="' + direction + '" aria-label="[^"]+"><svg[^>]+aria-hidden="true"'));
  }
  assert.doesNotMatch(html, /<button data-control="(forward|back|left|right)"[^>]*>[↑↓↶↷]<\/button>/);
});

test('iOS touch controls suppress long press selection, callouts and dragging', () => {
  assert.match(html, /\.mobile-controls,.mobile-controls button,.mobile-controls button \*\{/);
  assert.match(html, /-webkit-user-select:none;user-select:none;-webkit-touch-callout:none/);
  assert.match(html, /-webkit-user-drag:none;touch-action:none/);
  assert.match(html, /\['contextmenu','selectstart','dragstart'\]/);
  assert.match(html, /mobileControlArea\.addEventListener\(eventName,e=>e\.preventDefault\(\)\)/);
});

test('held pointer controls and cancel/release handling are preserved', () => {
  assert.match(html, /btn\.setPointerCapture\(e\.pointerId\)/);
  assert.match(html, /keys\.add\(key\);if\(stopped\)begin\(\);autoplay=false/);
  assert.match(html, /\['pointerup','pointercancel','lostpointercapture'\]/);
});
