// Paste into a javascript tool call after each navigation on a Google console page.
// Everything is attached to window so later calls in the same page can reuse it.

const W = ms => new Promise(r => setTimeout(r, ms));
window.__W = W;

/** querySelectorAll that also walks open shadow roots */
window.__q = sel => {
  const all = [];
  (function walk(r) {
    r.querySelectorAll('*').forEach(e => { if (e.shadowRoot) walk(e.shadowRoot); if (e.matches(sel)) all.push(e); });
  })(document);
  return all;
};
window.__vis = e => e.getBoundingClientRect().height > 0;

/** set an <input>/<textarea> value so Angular notices it */
window.__set = (el, v) => {
  const p = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(p, 'value').set.call(el, v);
  ['input', 'change', 'blur'].forEach(t => el.dispatchEvent(new Event(t, { bubbles: true })));
};

/** visible text fields in DOM order (hidden copies of other languages/steps excluded) */
window.__fields = () => __q('input,textarea').filter(e => __vis(e) && !['file', 'checkbox', 'radio', 'hidden'].includes(e.type));

/** click the last visible button whose label is exactly txt (optionally inside the open dialog) */
window.__btn = (txt, inDialog = false) => {
  const d = inDialog ? __q('[role=dialog],material-dialog').filter(__vis).pop() : null;
  const b = __q('button,a,[role=button]').filter(e => __vis(e) && (e.innerText || '').trim() === txt && (!d || d.contains(e)));
  if (!b.length) return 'no ' + txt;
  b[b.length - 1].click();
  return 'clicked ' + txt;
};

/** click a Material radio/checkbox by the start of its label; returns its new checked state */
window.__pick = (label, sel = 'material-radio,material-checkbox,mat-checkbox') => {
  const el = __q(sel).filter(__vis).find(e => (e.innerText || '').trim().startsWith(label));
  if (!el) return 'missing ' + label;
  el.click();
  return label + ':' + el.querySelector('input')?.checked;
};

/** list radios with index + label, to answer questionnaires by index */
window.__radios = () => __q('material-radio').map((e, i) => i + ':' + (e.innerText || '').trim().split('\n')[0] +
  (e.querySelector('input')?.checked ? '*' : '')).join(' | ');

/** did the last save succeed? */
window.__saved = () => (document.body.innerText.match(/Modification enregistrée|Vos modifications ont été enregistrées|Brouillon enregistré|Changes saved|Draft saved/) || ['NOT SAVED'])[0];

/** asset library: click "Ajouter"/"Add" once a freshly uploaded file is selected */
window.__addSel = async () => {
  for (let i = 0; i < 20; i++) {
    const b = __q('button').filter(e => __vis(e) && /(^|\n)(Ajouter|Add)$/.test((e.innerText || '').trim()));
    if (b.length) { b[b.length - 1].click(); await W(1500); return 'added'; }
    await W(500);
  }
  return 'NO ADD BUTTON';
};

/** capture what a "copy" button would put in the clipboard (e.g. a tester link) */
window.__captureCopy = () => {
  window.__copied = [];
  navigator.clipboard.writeText = t => { window.__copied.push(t); return Promise.resolve(); };
};

/** text around a heading, for reading long pages cheaply */
window.__around = (needle, n = 1500) => { const t = document.body.innerText; const i = t.indexOf(needle); return i < 0 ? 'not found' : t.slice(i, i + n); };

'helpers ready';
