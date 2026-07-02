/* Convert an inline CSS string ("padding:10px;color:red") into a React style
   object ({ padding: '10px', color: 'red' }). Lets us port the original
   inline-styled markup into JSX components almost verbatim.

   Note: values here never contain semicolons (gradients use commas), so a
   simple split on ';' is safe. Custom properties (--x) are preserved as-is;
   everything else is camelCased, including vendor prefixes (-webkit- -> Webkit). */
export function css(str) {
  const out = {};
  if (!str) return out;
  for (const decl of String(str).split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!prop) continue;
    if (prop.startsWith('--')) { out[prop] = val; continue; }
    const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = val;
  }
  return out;
}
