/* Retro3DMaze mobile screen gestures: left floating joystick + right drag-to-look.
   The D-pad below the game remains an independent, simultaneously usable input. */
(() => {
  'use strict';
  const RADIUS = 56;
  const DEAD_ZONE = 8;
  const LOOK_RADIANS_PER_PIXEL = 0.009;

  function attach({canvas, viewport, joystick, thumb, enabled, manualInput, rotate}) {
    if (!canvas || !viewport || !joystick || !thumb) throw new Error('Missing screen-touch elements');
    let moveId = null;
    let lookId = null;
    let anchorX = 0;
    let anchorY = 0;
    let lookX = 0;
    let forward = 0;
    let strafe = 0;

    function clearMove() {
      moveId = null;
      forward = 0;
      strafe = 0;
      joystick.classList.remove('active');
      thumb.style.transform = 'translate(-50%, -50%)';
    }
    function reset() {
      clearMove();
      lookId = null;
    }
    function updateMove(x, y) {
      const dx = x - anchorX;
      const dy = y - anchorY;
      const distance = Math.hypot(dx, dy);
      const limited = Math.min(RADIUS, distance);
      const scale = distance > 0 ? limited / distance : 0;
      thumb.style.transform = `translate(calc(-50% + ${dx * scale}px), calc(-50% + ${dy * scale}px))`;
      const strength = Math.max(0, (limited - DEAD_ZONE) / (RADIUS - DEAD_ZONE));
      strafe = distance > 0 ? strength * dx / distance : 0;
      forward = distance > 0 ? -strength * dy / distance : 0;
    }
    function blockBrowserGesture(event) {
      if (event.cancelable) event.preventDefault();
    }
    function touchStart(event) {
      if (!enabled()) return;
      const rect = canvas.getBoundingClientRect();
      let captured = false;
      for (const touch of event.changedTouches) {
        const zone = (touch.clientX - rect.left) / rect.width;
        if (zone < 0 || zone > 1) continue;
        if (zone < 0.55 && moveId === null) {
          moveId = touch.identifier;
          anchorX = touch.clientX;
          anchorY = touch.clientY;
          forward = 0;
          strafe = 0;
          const viewportRect = viewport.getBoundingClientRect();
          joystick.style.left = `${touch.clientX - viewportRect.left}px`;
          joystick.style.top = `${touch.clientY - viewportRect.top}px`;
          joystick.classList.add('active');
          updateMove(touch.clientX, touch.clientY);
          captured = true;
        } else if (zone >= 0.55 && lookId === null) {
          lookId = touch.identifier;
          lookX = touch.clientX;
          captured = true;
        }
      }
      if (captured) {
        manualInput();
        blockBrowserGesture(event);
      }
    }
    function touchMove(event) {
      if (!enabled()) { reset(); return; }
      let captured = false;
      for (const touch of event.changedTouches) {
        if (touch.identifier === moveId) {
          updateMove(touch.clientX, touch.clientY);
          captured = true;
        } else if (touch.identifier === lookId) {
          const dx = Math.max(-90, Math.min(90, touch.clientX - lookX));
          lookX = touch.clientX;
          rotate(dx * LOOK_RADIANS_PER_PIXEL);
          captured = true;
        }
      }
      if (captured) blockBrowserGesture(event);
    }
    function touchEnd(event) {
      let captured = false;
      for (const touch of event.changedTouches) {
        if (touch.identifier === moveId) {
          clearMove();
          captured = true;
        } else if (touch.identifier === lookId) {
          lookId = null;
          captured = true;
        }
      }
      if (captured) blockBrowserGesture(event);
    }
    canvas.addEventListener('touchstart', touchStart, {passive:false});
    canvas.addEventListener('touchmove', touchMove, {passive:false});
    canvas.addEventListener('touchend', touchEnd, {passive:false});
    canvas.addEventListener('touchcancel', touchEnd, {passive:false});
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });

    return {getMove: () => ({forward, strafe}), reset};
  }
  window.RetroScreenTouch = {attach};
})();