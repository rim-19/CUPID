/* Build-time static pre-render: renders <App/> to HTML and injects it into the
   client index.html so the served page is content-complete. Run after both the
   client build and the SSR build (see the npm "build" script).

   We then strip whitespace-only text nodes that contain a newline and live
   OUTSIDE the trusted display:contents partials. Those are JSX-formatting
   artifacts that the client (Babel) build removes but the SSR transform keeps;
   leaving them in would make the server DOM differ from the hydrated tree. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distIndex = path.join(__dirname, 'dist', 'index.html');
const ssrEntry = path.join(__dirname, 'dist-ssr', 'entry-server.js');

const { render } = await import(pathToFileURL(ssrEntry).href);
const appHtml = render();

const dom = new JSDOM(appHtml);
const { document, NodeFilter } = dom.window;
const app = document.getElementById('app');

function insidePartial(node) {
  let el = node.parentElement;
  while (el && el.id !== 'app') {
    const style = el.getAttribute && el.getAttribute('style');
    if (style && style.includes('display:contents')) return true;
    el = el.parentElement;
  }
  return false;
}

const walker = document.createTreeWalker(app, NodeFilter.SHOW_TEXT);
const toRemove = [];
let n;
while ((n = walker.nextNode())) {
  if (/^\s+$/.test(n.nodeValue) && n.nodeValue.includes('\n') && !insidePartial(n)) {
    toRemove.push(n);
  }
}
toRemove.forEach((t) => t.parentNode.removeChild(t));

const cleaned = app.outerHTML;
const template = fs.readFileSync(distIndex, 'utf-8');
if (!template.includes('<div id="root"></div>')) {
  throw new Error('prerender: could not find empty #root in dist/index.html');
}
const out = template.replace('<div id="root"></div>', `<div id="root">${cleaned}</div>`);
fs.writeFileSync(distIndex, out);
console.log(
  `Pre-rendered dist/index.html (${cleaned.length.toLocaleString()} chars, removed ${toRemove.length} stray whitespace node(s)).`
);
