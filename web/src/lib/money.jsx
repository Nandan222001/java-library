export function formatINR(paise) {
  return (paise / 100).toLocaleString('en-IN');
}

/* Our serif display fonts (Playfair Display, Crimson Pro) don't ship a
 * glyph for ₹ (U+20B9) — the browser silently falls back to a mismatched
 * system serif for just that one character, so it renders in a visibly
 * different style/weight than the digits right next to it. Render the
 * symbol in a guaranteed-coverage sans stack instead (see .inr-sym). */
export function Money({ paise }) {
  return <><span className="inr-sym">₹</span>{formatINR(paise)}</>;
}
