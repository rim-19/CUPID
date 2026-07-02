/* Events, richer than the card needs so the detail view has something to show.
   id matches the order of the cards in the events section. No em/en dashes. */

export const eventList = [
  {
    id: '0',
    month: 'Feb', day: '14', icon: 'heart',
    type: 'Sweetheart night',
    title: 'Blind-date-with-a-book & cocoa social',
    time: 'Fri \u00B7 7:00pm', place: 'the back room',
    spots: 'Limited to 24 seats',
    desc: [
      'Our busiest night of the season. The back room fills with candles, the cocoa pot never stops, and every guest leaves with a book wrapped in plain paper and three clues.',
      'Come alone or drag a friend. Halfway through the night we read the clues aloud and let the room guess. Nobody guesses correctly. That has never once stopped anybody.',
    ],
  },
  {
    id: '1',
    month: 'Feb', day: '18', icon: 'rose',
    type: 'Poetry night',
    title: 'Candlelit verse & cocoa, open mic',
    time: 'Tue \u00B7 8:00pm', place: 'the loft',
    spots: 'Open mic, drop-in',
    desc: [
      'Bring a poem, yours or someone else\u2019s, or bring only your ears. The loft seats about thirty if everyone is friendly, and on poetry night everyone is friendly.',
      'The list opens at 7:45 and fills fast. Five minutes a reader, one cup of cocoa per poem, and a strictly enforced policy of generous applause.',
    ],
  },
  {
    id: '2',
    month: 'Feb', day: '22', icon: 'balloon',
    type: 'Storytime',
    title: 'Saturday morning tales for tiny readers',
    time: 'Sat \u00B7 10:30am', place: 'the kids nook',
    spots: 'Best for ages 3 to 7',
    desc: [
      'Half an hour of picture books, silly voices, and one song we are all slightly too old to be singing. Caregivers get a quiet cup while the little ones sit on the rug.',
      'No need to reserve, but a heads-up helps us pull enough cushions. Latecomers are always welcome at the back of the rug.',
    ],
  },
  {
    id: '3',
    month: 'Feb', day: '25', icon: 'cup',
    type: 'Book club',
    title: 'Sugar & Smoke: pastries & pour-overs',
    time: 'Tue \u00B7 6:30pm', place: 'the counter',
    spots: 'Read along first',
    desc: [
      'This month we are arguing about Sugar & Smoke over pour-overs and whatever the kitchen pulled out of the oven that afternoon. Strong opinions encouraged, spoilers fully expected.',
      'You do not have to finish the book to come, but you will enjoy yourself more if the ending is fresh. We meet at the long counter near the window.',
    ],
  },
];

export function eventById(id) {
  return eventList.find((e) => e.id === String(id)) || null;
}
