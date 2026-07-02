import React from 'react';

/* Renders a trusted, pre-built section partial. The wrapper uses
   display:contents so it adds no box of its own; the partial's own root
   element (section / header / div) becomes the effective child of #app,
   keeping the original layout and CSS selectors intact.

   suppressHydrationWarning: these partials are hand-authored HTML whose
   serialization (valueless attributes, whitespace, entity casing) will not
   byte-match the browser's normalized parse. The content is identical and
   static, so we tell React to trust it during hydration. */
export default function Block({ html }) {
  return (
    <div
      style={{ display: 'contents' }}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
