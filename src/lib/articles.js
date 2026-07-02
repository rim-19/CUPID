/* Full blog articles. id matches the order of the cards in the blog section,
   so a card linking to #post/0 opens the first article here. Bodies are arrays
   of paragraphs. No em or en dashes anywhere - hyphens only. */

export const articles = [
  {
    id: '0',
    cat: 'Staff picks',
    date: 'Feb 12',
    read: '4 min read',
    icon: 'cup',
    tint: 'linear-gradient(160deg,#5a4a30,#2e2618)',
    title: 'Six books that pair with a flat white',
    excerpt: 'Crisp prose, woodsmoke moods, and at least one with a recipe for cardamom coffee tucked in the back.',
    body: [
      'A flat white is a quiet drink. No foam to speak of, no theatrics, just espresso and steamed milk meeting in the middle. The books that pair with it are the same: unhurried, warm, and a little stronger than they look.',
      'We started this list on a slow Tuesday when the rain would not let up and the counter was empty. By the second cup we had argued our way down to six titles, and by the third we had stopped pretending the order mattered.',
      'The first is the kind of novel you read with your shoulders down. Long sentences, a small town, a narrator who notices the weather. The second is sharper, all dialogue and bad decisions, the literary equivalent of the second shot you did not plan to order.',
      'Halfway through the shelf there is a slim book of essays about kitchens, and yes, there is a recipe for cardamom coffee folded into the last chapter. We have made it. It is very good, and it has no business being in a book about grief, which is exactly why it works.',
      'If you only take one home, take the one with the orchard on the cover. Read it slowly. Let the milk go a little cool. Some stories are better at the temperature of a forgotten cup.',
    ],
  },
  {
    id: '1',
    cat: 'Behind the counter',
    date: 'Feb 06',
    read: '3 min read',
    icon: 'rose',
    tint: 'linear-gradient(160deg,#5a3340,#33212a)',
    title: 'How we wrap a blind date',
    excerpt: 'The art of three clues and zero spoilers. A peek into the most secretive corner of the shop.',
    body: [
      'Every blind date with a book starts the same way: a keeper stands at the back table, holds a book they love, and tries to describe it without giving anything away. This is harder than it sounds, and it is the best part of the job.',
      'The rule is three clues and zero spoilers. A mood, a texture, and one small promise. "Slow burn, salt air, ends softer than it begins." That is the whole pitch. No title, no author, no cover. Just enough to make you curious and not enough to make you sure.',
      'We wrap them in plain paper so the weight and shape give nothing away either. A thin book of poems and a doorstop of a novel should feel like a gamble right up until you tear the corner.',
      'People ask if we are ever tempted to match the book to the person. We are, constantly, and we try not to. The whole point of a blind date is that it is not optimised. Sometimes the best book you read all year is the one an algorithm would never have handed you.',
    ],
  },
  {
    id: '2',
    cat: 'Reading life',
    date: 'Jan 29',
    read: '5 min read',
    icon: 'moon',
    tint: 'linear-gradient(160deg,#5e3550,#301a2c)',
    title: 'In praise of the slow re-read',
    excerpt: 'Why the second visit to a story is often the kinder one, and the books we return to each year.',
    body: [
      'There is a particular kind of reader who never opens the same book twice, and we understand them, and we are not them. Some books are houses you move into. You learn where the light falls. You come back.',
      'The first read is for the plot. You are turning pages to find out, and that hunger is its own pleasure. The second read is for everything the hunger made you skip: the way a minor character is quietly breaking, the joke planted two hundred pages before its punchline.',
      'A re-read is also a way of measuring yourself. The book has not changed since last winter, but you have, and the parts that move you now are not the parts that moved you then. The same paragraph that felt sentimental at twenty can level you at thirty-five.',
      'We keep a short shelf behind the counter of books we return to every year. None of them are the ones we would call the best books we have ever read. They are just the ones that feel like coming home, and that turns out to be a different and more useful thing.',
      'So if you finished something this month and felt that small ache of leaving, consider not leaving. Go back to page one. The story will be the same. You will not be, and that is the entire point.',
    ],
  },
];

export function articleById(id) {
  return articles.find((a) => a.id === String(id)) || null;
}
