import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { windowReducer, initialWindowState } from '../lib/win11/windowState';

describe('Window state reducer', () => {
  const initialState = { ...initialWindowState };

  it('initializes with empty state', () => {
    assert.equal(Object.keys(initialState.windows).length, 0);
    assert.equal(initialState.zCounter, 0);
  });

  it('OPEN creates a new window', () => {
    const state = windowReducer(initialState, {
      type: 'OPEN', id: 'outlook', name: 'Outlook', icon: '📧', appType: 'outlook',
    });
    assert.ok(state.windows['outlook']);
    assert.equal(state.windows['outlook'].name, 'Outlook');
    assert.equal(state.windows['outlook'].hide, false);
    assert.equal(state.windows['outlook'].max, true);
    assert.equal(state.windows['outlook'].z, 1);
    assert.equal(state.zCounter, 1);
  });

  it('OPEN multiple windows increments z', () => {
    let s = windowReducer(initialState, { type: 'OPEN', id: 'a', name: 'A', icon: 'A', appType: 'a' });
    s = windowReducer(s, { type: 'OPEN', id: 'b', name: 'B', icon: 'B', appType: 'b' });
    assert.equal(s.windows['a'].z, 1);
    assert.equal(s.windows['b'].z, 2);
  });

  it('CLOSE hides a window', () => {
    let s = windowReducer(initialState, { type: 'OPEN', id: 'a', name: 'A', icon: 'A', appType: 'a' });
    s = windowReducer(s, { type: 'CLOSE', id: 'a' });
    assert.equal(s.windows['a'].hide, true);
  });

  it('MINIMIZE hides without closing', () => {
    let s = windowReducer(initialState, { type: 'OPEN', id: 'a', name: 'A', icon: 'A', appType: 'a' });
    s = windowReducer(s, { type: 'MINIMIZE', id: 'a' });
    assert.equal(s.windows['a'].max, false);
    assert.equal(s.windows['a'].hide, false);
  });

  it('RESTORE brings window back and focuses', () => {
    let s = windowReducer(initialState, { type: 'OPEN', id: 'a', name: 'A', icon: 'A', appType: 'a' });
    const zBefore = s.windows['a'].z;
    s = windowReducer(s, { type: 'MINIMIZE', id: 'a' });
    s = windowReducer(s, { type: 'RESTORE', id: 'a' });
    assert.equal(s.windows['a'].max, true);
    assert.ok(s.windows['a'].z > zBefore);
  });

  it('FOCUS brings window to top', () => {
    let s = windowReducer(initialState, { type: 'OPEN', id: 'a', name: 'A', icon: 'A', appType: 'a' });
    s = windowReducer(s, { type: 'OPEN', id: 'b', name: 'B', icon: 'B', appType: 'b' });
    const zBefore = s.windows['a'].z;
    s = windowReducer(s, { type: 'FOCUS', id: 'a' });
    assert.ok(s.windows['a'].z > zBefore);
    assert.equal(s.windows['a'].z, s.zCounter);
  });

  it('MOVE updates position', () => {
    let s = windowReducer(initialState, { type: 'OPEN', id: 'a', name: 'A', icon: 'A', appType: 'a' });
    s = windowReducer(s, { type: 'MOVE', id: 'a', top: 100, left: 200 });
    assert.equal(s.windows['a'].dim.top, 100);
    assert.equal(s.windows['a'].dim.left, 200);
  });

  it('RESIZE updates dimensions', () => {
    let s = windowReducer(initialState, { type: 'OPEN', id: 'a', name: 'A', icon: 'A', appType: 'a' });
    s = windowReducer(s, { type: 'RESIZE', id: 'a', width: 600, height: 400 });
    assert.equal(s.windows['a'].dim.width, 600);
    assert.equal(s.windows['a'].dim.height, 400);
  });

  it('RESIZE enforces minimum dimensions', () => {
    let s = windowReducer(initialState, { type: 'OPEN', id: 'a', name: 'A', icon: 'A', appType: 'a' });
    s = windowReducer(s, { type: 'RESIZE', id: 'a', width: 50, height: 50 });
    assert.equal(s.windows['a'].dim.width, 300);
    assert.equal(s.windows['a'].dim.height, 200);
  });

  it('TOGGLE_START_MENU toggles', () => {
    let s = windowReducer(initialState, { type: 'TOGGLE_START_MENU' });
    assert.equal(s.startMenuOpen, true);
    s = windowReducer(s, { type: 'TOGGLE_START_MENU' });
    assert.equal(s.startMenuOpen, false);
  });

  it('SHOW_DESKTOP_CONTEXT_MENU sets position', () => {
    const s = windowReducer(initialState, { type: 'SHOW_DESKTOP_CONTEXT_MENU', x: 100, y: 200 });
    assert.equal(s.desktopContextMenu?.x, 100);
    assert.equal(s.desktopContextMenu?.y, 200);
  });

  it('OPEN on visible window focuses it', () => {
    let s = windowReducer(initialState, { type: 'OPEN', id: 'a', name: 'A', icon: 'A', appType: 'a' });
    s = windowReducer(s, { type: 'OPEN', id: 'b', name: 'B', icon: 'B', appType: 'b' });
    const zBefore = s.windows['a'].z;
    s = windowReducer(s, { type: 'OPEN', id: 'a', name: 'A', icon: 'A', appType: 'a' });
    assert.ok(s.windows['a'].z > zBefore);
    assert.equal(s.windows['a'].hide, false);
  });
});
