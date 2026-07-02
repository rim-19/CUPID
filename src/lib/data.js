/* Content for the data-driven sections rendered as real React components.
   (The remaining bespoke sections render their proven markup as partials.) */

export const categories = [
  { name: 'Fiction',       ic: 'book',    count: 2140, tint: 'rgba(232,133,154,.16)' },
  { name: 'Romance',       ic: 'rose',    count: 980,  tint: 'rgba(232,133,154,.24)' },
  { name: 'Fantasy',       ic: 'sparkle', count: 1320, tint: 'rgba(214,160,106,.18)' },
  { name: 'Mystery',       ic: 'search',  count: 760,  tint: 'rgba(200,115,86,.18)' },
  { name: 'Poetry',        ic: 'heart',   count: 410,  tint: 'rgba(232,133,154,.18)' },
  { name: 'Nonfiction',    ic: 'compass', count: 1540, tint: 'rgba(214,160,106,.16)' },
  { name: "Children's",    ic: 'balloon', count: 890,  tint: 'rgba(232,133,154,.2)' },
  { name: 'Food & Coffee', ic: 'cup',     count: 320,  tint: 'rgba(200,115,86,.18)' },
];

export const arrivals = [
  { title: 'The Lantern Orchard', author: 'M. Ashgrove', rating: '4.8', price: '$24', tint: 'linear-gradient(160deg,#5a3a28,#2e1d13)', lang: '', roast: 'Med', notes: 'pear, woodsmoke, long finish' },
  { title: 'Sugar & Smoke', author: 'D. Fenwick', rating: '4.6', price: '$19', tint: 'linear-gradient(160deg,#4a3526,#251a12)', lang: '', roast: 'Dark', notes: 'cocoa, char, bittersweet' },
  { title: 'A Year of Small Rains', author: 'I. Voss', rating: '4.9', price: '$22', tint: 'linear-gradient(160deg,#7a4332,#3a201a)', lang: '', roast: 'Light', notes: 'rain, bergamot, clean' },
  { title: 'The Quiet Between Stars', author: 'N. Calder', rating: '4.7', price: '$26', tint: 'linear-gradient(160deg,#5e3550,#301a2c)', lang: '', roast: 'Med', notes: 'plum, dusk, slow burn' },
  { title: 'Salt House', author: 'E. Marsh', rating: '4.5', price: '$18', tint: 'linear-gradient(160deg,#6e4348,#352025)', lang: '', roast: 'Med', notes: 'brine, almond, melancholy' },
  { title: "Le Jardin d'Hiver", author: 'C. Aubry', rating: '4.8', price: '$27', tint: 'linear-gradient(160deg,#6a4a2e,#33241a)', lang: 'Français', roast: 'Light', notes: 'honey, frost, tender' },
  { title: 'Tea for the Wandering', author: 'R. Pellow', rating: '4.6', price: '$21', tint: 'linear-gradient(160deg,#5a4a30,#2e2618)', lang: '', roast: 'Med', notes: 'cardamom, road dust, warm' },
  { title: '\u0623\u0648\u0631\u0627\u0642 \u0627\u0644\u062E\u0631\u064A\u0641', author: 'L. Haddad', rating: '4.9', price: '$23', tint: 'linear-gradient(160deg,#5a3340,#33212a)', lang: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629', roast: 'Dark', notes: 'fig, amber, lingering' },
];

export const events = [
  { month: 'Feb', day: '14', ic: 'heart',   type: 'Sweetheart night', title: 'Blind-date-with-a-book & cocoa social', time: 'Fri \u00B7 7:00pm \u00B7 back room' },
  { month: 'Feb', day: '18', ic: 'rose',    type: 'Poetry night',     title: 'Candlelit verse & cocoa, open mic',     time: 'Tue \u00B7 8:00pm \u00B7 the loft' },
  { month: 'Feb', day: '22', ic: 'balloon', type: 'Storytime',        title: 'Saturday morning tales for tiny readers', time: 'Sat \u00B7 10:30am \u00B7 kids nook' },
  { month: 'Feb', day: '25', ic: 'cup',     type: 'Book club',        title: 'Sugar & Smoke: pastries & pour-overs',   time: 'Tue \u00B7 6:30pm \u00B7 the counter' },
];

export const posts = [
  { ic: 'cup',  cat: 'Staff picks',        date: 'Feb 12', title: 'Six books that pair with a flat white', excerpt: 'Crisp prose, woodsmoke moods, and at least one with a recipe for cardamom coffee tucked in the back.', tint: 'linear-gradient(160deg,#5a4a30,#2e2618)' },
  { ic: 'rose', cat: 'Behind the counter', date: 'Feb 06', title: 'How we wrap a blind date',          excerpt: 'The art of three clues and zero spoilers. A peek into the most secretive corner of the shop.',   tint: 'linear-gradient(160deg,#5a3340,#33212a)' },
  { ic: 'moon', cat: 'Reading life',       date: 'Jan 29', title: 'In praise of the slow re-read',        excerpt: 'Why the second visit to a story is often the kinder one, and the books we return to each year.', tint: 'linear-gradient(160deg,#5e3550,#301a2c)' },
];
