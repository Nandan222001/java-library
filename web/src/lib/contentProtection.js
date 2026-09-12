/* Deterrents against casual copying/right-click-saving/printing.
 *
 * IMPORTANT — read before relying on this: nothing here blocks an actual
 * OS-level screenshot (Print Screen, a phone's screenshot gesture, an
 * external camera pointed at the screen) on desktop OR mobile. No website
 * can intercept that — there is no browser API for it. What a page CAN
 * reliably intercept is: the right-click menu, the browser's own
 * Ctrl+S / Ctrl+P / Ctrl+U shortcuts, and text selection/drag (handled in
 * index.css). Combined with the reader's per-user watermark
 * (Reader.jsx), this is the same practical approach every paywalled
 * reading platform actually uses — raise the friction on casual copying,
 * and make a leak traceable back to the account, rather than pretend to
 * "prevent" it outright. */
export function installContentProtection() {
  document.addEventListener('contextmenu', e => e.preventDefault());

  document.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    const isMod = e.ctrlKey || e.metaKey;
    if (isMod && ['s', 'p', 'u'].includes(key)) e.preventDefault();
  });

  /* Soft deterrent against screen-recording/casual photographing while the
   * tab is backgrounded — trivially bypassed, but harmless and free. */
  const dim = () => document.documentElement.classList.add('cp-dim');
  const undim = () => document.documentElement.classList.remove('cp-dim');
  window.addEventListener('blur', dim);
  window.addEventListener('focus', undim);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) dim(); else undim();
  });
}
