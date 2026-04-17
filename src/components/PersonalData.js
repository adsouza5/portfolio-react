// ─────────────────────────────────────────────────────────
//  PERSONAL CONTENT — edit this file to update your page
// ─────────────────────────────────────────────────────────

export const INTRO =
  "Outside of building software I spend my time writing, exploring the city, " +
  "and finding the overlap between creativity and logic. This page is less " +
  "résumé, more real.";

// ── Hobbies ──────────────────────────────────────────────
// icon: any emoji  |  name: label  |  desc: one-liner
export const HOBBIES = [
  {
    icon: '✍️',
    name: 'Writing',
    desc: 'Poetry, short stories, and the occasional late-night journal entry.',
  },
  {
    icon: '📸',
    name: 'Photography',
    desc: 'Capturing moments — street, travel, and anything with good light.',
  },
  {
    icon: '🎵',
    name: 'Music',
    desc: 'Always have something playing. Genres depend on the mood.',
  },
  {
    icon: '🌍',
    name: 'Travelling',
    desc: "Wherever there's a new culture, food, or skyline to discover.",
  },
];

// ── Poems / Writing ──────────────────────────────────────
// title: displayed above the poem
// body:  use \n for line breaks within a stanza, \n\n for stanza breaks
export const POEMS = [
  {
    title: 'Red Reef',
    body:
      `A little stream of water,\nWashes away all the clutter,\nSee through with a tint of green,\nWishpering wonders of the unseen,\nHidden amidst the mountains a trail,\nSome deem it the holy grail,` +

      `\n\nRocks and hollow barks of what were once trees,\nFlowers inhabited by butterflies and bumblebees,\nDirect adventurers to the path not taken,\nThe travelers venture forward, amused by what was once forsaken,` +

      `\n\nThe stream reappears, brimming with life,\nThe harrowing silence cut with a sharp knife,\nIt draws the travelers in serach of the source,\nCuriosity, at the heart of this traveler's course,\nRocks in the shape of waves,\nSeem like ripples through time and space,\nThe travelers in their state of trance,\nHave it broken by the streams sudden melancholic dance,` +

      `\n\nThe surroudnings merge to form a picturesque waterfall,\nRocks by the wayside, heeding to the traveler's curious call,\nSplish splash, the boots sound,\nThe source of the stream, a merry go round,\nUnlike the simple kind, the travelers begin,\nTheir journey into the heart within.` +

      `\n\nThey shuffled and scrambled up withered boulders,\nAvoiding the water that now reached their shoulders,\nA point of view that took their breath,\nNo way forward, dead end ahead,\nAnother path spotted however,\nThe travelers decide to ascent it together,` +

      `\n\nA mountain covered in patches of moss,\nJaded rocks that could cause memory loss,\nTossing the dry bramble to the side,\nThis journey had already been a wild ride,\nShades of green, red and brown,\nThe travelers dared not to look on down,\nBut the afterimages gushed in like the stream,\nAnd the travelers eyes started to gleam,\nA treasure they had found within,\nStories to share with their future kin,` +

      `\n\nFinally they halted at the summit,\nPaying little heed to the plummet,\nMore adventure ahead or so they imagined,\nOut of time, they hadn't fathomed,\nA journey cut short for now,\nThe travelers vowed to make it back somehow,\nBidding farewell to thee,\nThe travelers left in glee,\nA place not to be forgotten,\nA memory they will revisit often...`,
  },
  {
    title: 'A New York Fall',
    body:
      `Humid and warm, here comes another thunderstorm,\nTis the end of summer, the leaves take on a different form,\nGreen and yellow, red and brown,\nOne would find it hard to frown,\nFrom the birds chirp to the leaves rustle,\nWelcome to New York, the city of hustle,\nAs the days grow shorter, and the nights grow longer,\nYou turn into a true New Yorker,\nWithin the city that doesn't sleep,\nYou find that routine you want to keep,\nOne that explores your true potential,\nExperiences that prove quintessential`,
  },
  // Add more poems below:
  // {
  //   title: 'Poem Title',
  //   body: `First line.\nSecond line.\n\nNew stanza here.`,
  // },
];

// ── Photos ───────────────────────────────────────────────
// Replace each null with an S3 URL, e.g.:
// 'https://adam-dsouza-portfolio.s3.us-east-1.amazonaws.com/personal/photo1.jpg'
//
// Add or remove entries freely — the grid adjusts automatically.
const S3 = 'https://adam-dsouza-portfolio-891377045299-us-east-1-an.s3.us-east-1.amazonaws.com';

export const PHOTOS = [
  `${S3}/photo1.JPG`,
  `${S3}/photo2.jpg`,
  `${S3}/photo3.jpg`,
  `${S3}/photo4.jpg`,
  `${S3}/photo5.jpg`,
  `${S3}/photo7.jpg`,
  `${S3}/photo6.jpg`,
];
