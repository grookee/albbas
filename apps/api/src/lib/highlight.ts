import hljs from 'highlight.js/lib/core';
import type { LanguageFn } from 'highlight.js';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import graphql from 'highlight.js/lib/languages/graphql';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import less from 'highlight.js/lib/languages/less';
import lua from 'highlight.js/lib/languages/lua';
import makefile from 'highlight.js/lib/languages/makefile';
import markdown from 'highlight.js/lib/languages/markdown';
import nginx from 'highlight.js/lib/languages/nginx';
import objectivec from 'highlight.js/lib/languages/objectivec';
import perl from 'highlight.js/lib/languages/perl';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import pythonrepl from 'highlight.js/lib/languages/python-repl';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import scss from 'highlight.js/lib/languages/scss';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

const LANGUAGE_MODULES: Record<string, LanguageFn> = {
  bash,
  c,
  cpp,
  csharp,
  css,
  diff,
  dockerfile,
  go,
  graphql,
  ini,
  java,
  javascript,
  json,
  kotlin,
  less,
  lua,
  makefile,
  markdown,
  nginx,
  objectivec,
  perl,
  php,
  python,
  'python-repl': pythonrepl,
  ruby,
  rust,
  scss,
  shell,
  sql,
  typescript,
  xml,
  yaml,
};

for (const [name, fn] of Object.entries(LANGUAGE_MODULES)) {
  hljs.registerLanguage(name, fn);
}

export function isHighlightableLanguage(language: string): boolean {
  return Object.hasOwn(LANGUAGE_MODULES, language);
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function highlightCode(code: string, language: string): string {
  if (!isHighlightableLanguage(language) || language === 'text') {
    return escapeHtml(code);
  }
  try {
    return hljs.highlight(code, { language, ignoreIllegals: true }).value;
  } catch {
    return escapeHtml(code);
  }
}

export interface PastePageOptions {
  slug: string;
  title: string | null;
  language: string;
  content: string;
  baseUrl: string;
  webUrl: string;
  sizeBytes: number;
  createdAt: Date;
  visits: number;
  highlighted: boolean;
}

function numberLines(html: string): string {
  const lines = html.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines
    .map(
      (line, index) =>
        `<span class="ln"><span class="pln">${index + 1}</span><span class="plc">${line}</span></span>`,
    )
    .join('');
}

function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', ' UTC').slice(0, 19);
}

export function renderPastePage(opts: PastePageOptions): string {
  const language = escapeHtml(opts.language || 'text');
  const title = opts.title ? escapeHtml(opts.title) : `paste ${escapeHtml(opts.slug)}`;
  const rawUrl = `${opts.baseUrl}/${opts.slug}?raw=1`;
  const codeHtml = opts.highlighted
    ? highlightCode(opts.content, opts.language)
    : escapeHtml(opts.content);
  const lineCount = opts.content.split('\n').length;
  const meta: string[] = [String(lineCount) + ' lines'];
  meta.push(`${(opts.sizeBytes / 1024).toFixed(1)} KB`);
  meta.push(formatDate(opts.createdAt));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — albbas</title>
<style>
:root{--bg:#282828;--panel:#3c3836;--panel2:#504945;--border:#665c54;--fg:#ebdbb2;--muted:#928374;--orange:#fe8019;--fs:14px}
*{box-sizing:border-box}html,body{margin:0;padding:0}
body{background:var(--bg);color:var(--fg);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:var(--fs);line-height:1.6}
.top{display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1rem;background:var(--panel);border-bottom:1px solid var(--border);flex-wrap:wrap}
.brand{color:var(--orange);font-weight:700;text-decoration:none}
.langs{background:var(--panel2);border:1px solid var(--border);border-radius:999px;padding:0.1rem 0.6rem;color:var(--muted);font-size:12px}
.meta{color:var(--muted);font-size:12px;display:flex;gap:0.75rem;flex-wrap:wrap}
.spacer{flex:1}
.act{display:flex;gap:0.4rem}
.act a,.act button{cursor:pointer;font:inherit;font-size:12px;color:var(--fg);background:var(--panel2);border:1px solid var(--border);border-radius:6px;padding:0.25rem 0.7rem;text-decoration:none}
.act a:hover,.act button:hover{border-color:var(--muted)}
.act button.on{color:var(--orange);border-color:var(--orange)}
.wrap{padding:1rem;max-width:1200px;margin:0 auto}
.code{margin:0;padding:0;overflow:auto;background:var(--panel);border:1px solid var(--border);border-radius:8px;max-height:75vh}
.code.wrap{white-space:pre-wrap;overflow-x:hidden}
.code.wrap .plc{white-space:pre-wrap}
.code .ln{display:flex}
.pln{display:inline-block;min-width:3.5rem;padding:0 0.75rem;text-align:right;color:var(--muted);user-select:none;background:var(--panel2);border-right:1px solid var(--border)}
.plc{display:block;padding:0 1rem;white-space:pre}
.hljs{display:block;color:var(--fg)}
.hljs-comment,.hljs-quote{color:#928374}.hljs-keyword,.hljs-selector-tag,.hljs-subst{color:#fb4934}
.hljs-number,.hljs-literal,.hljs-variable,.hljs-template-variable,.hljs-tag .hljs-attr{color:#d3869b}
.hljs-string,.hljs-doctag,.hljs-regexp{color:#b8bb26}.hljs-title,.hljs-section,.hljs-selector-id{color:#83a598}
.hljs-type,.hljs-class .hljs-title{color:#fabd2f}.hljs-attr,.hljs-symbol,.hljs-bullet,.hljs-link{color:#8ec07c}
.hljs-meta{color:#d79921}.hljs-built_in,.hljs-builtin-name{color:#fe8019}
.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:bold}
.hljs-addition{color:#b8bb26;background:#18381a}.hljs-deletion{color:#fb4934;background:#40211e}
</style>
</head>
<body>
<div class="top">
  <a class="brand" href="${opts.webUrl}">albbas</a>
  <span class="langs">${language}</span>
  <span>${title}</span>
  <span class="spacer"></span>
  <span class="meta">${meta.join(' · ')}</span>
  <span class="act">
    <button id="fs-dec" title="Decrease font size" aria-label="Decrease font size">A−</button>
    <button id="fs-inc" title="Increase font size" aria-label="Increase font size">A+</button>
    <button id="fs-reset" title="Reset font size" aria-label="Reset font size">reset</button>
    <button id="wrap" title="Toggle line wrap" aria-label="Toggle line wrap">wrap</button>
    <a href="${rawUrl}" rel="external">raw</a>
    <button id="copy">copy</button>
  </span>
</div>
<div class="wrap">
<pre class="code"><code class="hljs language-${language}">${numberLines(codeHtml)}</code></pre>
</div>
<script>
(function(){
var root=document.documentElement,code=document.querySelector(".code");
var DEF=14,MIN=9,MAX=36;
function fs(){var v=parseInt(root.style.getPropertyValue("--fs"),10);return isNaN(v)?DEF:v;}
function setFs(v){v=Math.max(MIN,Math.min(MAX,v));root.style.setProperty("--fs",v+"px");try{localStorage.setItem("paste-fs",String(v));}catch(e){}}
try{var saved=parseInt(localStorage.getItem("paste-fs"),10);if(!isNaN(saved))setFs(saved);}catch(e){}
var dec=document.getElementById("fs-dec"),inc=document.getElementById("fs-inc"),res=document.getElementById("fs-reset");
dec.addEventListener("click",function(){setFs(fs()-1);});
inc.addEventListener("click",function(){setFs(fs()+1);});
res.addEventListener("click",function(){setFs(DEF);});
var wrapBtn=document.getElementById("wrap");
function setWrap(on){code.classList.toggle("wrap",on);wrapBtn.classList.toggle("on",on);try{localStorage.setItem("paste-wrap",on?"1":"0");}catch(e){}}
var wrapSaved=false;try{wrapSaved=localStorage.getItem("paste-wrap")==="1";}catch(e){}
setWrap(wrapSaved);
wrapBtn.addEventListener("click",function(){setWrap(!code.classList.contains("wrap"));});
var b=document.getElementById("copy");
b.addEventListener("click",async()=>{try{const r=await fetch("${rawUrl}");const t=await r.text();await navigator.clipboard.writeText(t);const o=b.textContent;b.textContent="copied";setTimeout(()=>b.textContent=o,1500);}catch{}});
})();
</script>
</body>
</html>`;
}
