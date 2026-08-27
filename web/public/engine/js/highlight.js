/* ================= Tiny dependency-free syntax highlighter ================= */
window.HL = (function () {
  'use strict';
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const JAVA_KW = 'abstract|assert|boolean|break|byte|case|catch|char|class|continue|default|do|double|else|enum|extends|final|finally|float|for|if|implements|import|instanceof|int|interface|long|native|new|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while|var|record|sealed|permits|yield|true|false|null';

  const LANGS = {
    java: {
      re: new RegExp(
        '("(?:[^"\\\\\\n]|\\\\.)*")' +
        "|('(?:[^'\\\\\\n]|\\\\.)*')" +
        '|(/\\*[\\s\\S]*?\\*/)' +
        '|(//[^\\n]*)' +
        '|(@[A-Za-z_]\\w*)' +
        '|\\b(' + JAVA_KW + ')\\b' +
        '|\\b([A-Z][A-Za-z0-9_]*)\\b' +
        '|\\b(\\d[\\d_]*(?:\\.\\d+)?[fFdDlL]?)\\b', 'g'),
      map: ['st', 'st', 'co', 'co', 'an', 'kw', 'ty', 'nu']
    },
    sql: {
      re: /('(?:[^'\\\n]|\\.)*')|("(?:[^"\\\n]|\\.)*")|(--[^\n]*)|(\/\*[\s\S]*?\*\/)|\b(select|from|where|insert|update|delete|join|left|right|inner|outer|full|cross|on|group|by|order|having|limit|offset|create|table|index|view|drop|alter|add|primary|key|foreign|references|unique|not|null|default|as|and|or|in|exists|between|like|distinct|count|sum|avg|min|max|union|all|values|into|set|commit|rollback|transaction|begin|is|explain|analyze|with|case|when|then|else|end|asc|desc|constraint|check|cascade|serial|int|bigint|varchar|text|boolean|timestamp|numeric|uuid|auto_increment|returning|over|partition|row_number|rank)\b|(\b\d+\b)/gi,
      map: ['st', 'st', 'co', 'co', 'kw', 'nu']
    },
    yaml: {
      re: /(#[^\n]*)|("[^"\n]*"|'[^'\n]*')|((?:^|\n)[ \t]*(?:-[ ])?[\w.$\-\/{}]+(?=[ \t]*:))|\b(true|false|null)\b/g,
      map: ['co', 'st', 'ky', 'kw']
    },
    bash: {
      re: /(#[^\n]*)|("(?:[^"\\\n]|\\.)*")|\b(docker|kubectl|git|curl|wget|sudo|apt|apt-get|yum|cd|ls|cat|echo|export|source|run|build|exec|pull|push|tag|login|logs|compose|up|down|apply|get|describe|delete|npm|java|javac|mvn|gradle|chmod|mkdir|cp|mv)\b|(^|\s)(--?[a-zA-Z][\w-]*)/gm,
      map: ['co', 'st', 'kw', null, 'an']
    },
    json: {
      re: /("(?:[^"\\\n]|\\.)*"(?=\s*:))|("(?:[^"\\\n]|\\.)*")|(-?\d+(?:\.\d+)?)|\b(true|false|null)\b/g,
      map: ['ky', 'st', 'nu', 'kw']
    },
    xml: {
      re: /(<!--[\s\S]*?-->)|(<\/?[\w:-]+)|([\w.-]+)="([^"]*)"|(\/?>)/g,
      map: ['co', 'ky', 'an', 'st', 'ky']
    },
    props: {
      re: /(#[^\n]*)|(^[\w.*\-$]+)(?=\s*=)/gm,
      map: ['co', 'ky']
    }
  };
  const ALIAS = { yml: 'yaml', sh: 'bash', shell: 'bash', console: 'bash', html: 'xml', kv: 'props', properties: 'props', plaintext: '', text: '', txt: '' };

  function run(code, re, map) {
    let out = '', last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      let cls = null;
      for (let g = 1; g < m.length; g++) {
        if (m[g] !== undefined) { cls = map[g - 1] || null; break; }
      }
      out += cls ? '<span class="tk-' + cls + '">' + esc(m[0]) + '</span>' : esc(m[0]);
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    return out + esc(code.slice(last));
  }

  function highlight(code, lang) {
    let key = String(lang || '').toLowerCase();
    key = ALIAS[key] !== undefined ? ALIAS[key] : key;
    const L = LANGS[key];
    return L ? run(String(code), L.re, L.map) : esc(String(code));
  }

  /* decorate every <pre class="code"><code data-lang="…"> in a rendered page */
  function decorate(rootEl) {
    rootEl.querySelectorAll('pre.code > code').forEach(el => {
      if (el.dataset.hldone) return;
      const lang = el.getAttribute('data-lang') || el.parentElement.getAttribute('data-lang');
      if (!lang) return;
      el.dataset.hldone = '1';
      const raw = el.textContent.replace(/^[\r\n]+/, '').replace(/\s+$/, '');
      el.innerHTML = highlight(raw, lang);
    });
  }
  return { highlight, decorate, escape: esc };
})();
