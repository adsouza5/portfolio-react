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
    title: 'Untitled I',
    body: `Add your poem here.\nLine by line,\nthe way it feels right.`,
  },
  // {
  //   title: 'Another poem',
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
  `${S3}/photo6.jpg`, // ← replace with your 7th S3 URL
];
