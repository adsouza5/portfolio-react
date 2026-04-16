// Source of truth: Adam Dsouza resume (as of 2024)
// type: 'project' | 'work' | 'education'

const timelineEntries = [
  {
    type: 'work',
    title: 'Software Developer',
    org: 'Synechron',
    date: "Mar '24 – Present",
    location: 'New York, NY',
    description:
      'Optimised mobile app efficiency by 25% and maintainability by 20% migrating Java to Kotlin. Built advanced Jetpack Compose UI features including dark mode and a redesigned settings page, lifting user engagement 15%. Developed a secure Kotlin widget for card data display and leveraged Python with Tesseract and OpenCV for structured image-to-JSON text extraction.',
    tags: ['Kotlin', 'Jetpack Compose', 'Java', 'Python', 'OpenCV', 'Android'],
    link: null,
    status: null,
  },
  {
    type: 'project',
    title: 'Real-Time Collaborative Coding Platform',
    org: null,
    date: '2023',
    location: null,
    description:
      'Full-stack real-time collaboration tool with live code editing, syntax highlighting, and WebRTC video conferencing. Architected 100+ WebSocket events and Firebase integrations for live sync, chat, and video streaming. Boosted data synchronisation speed 25% through differential syncing and WebRTC optimisations.',
    tags: ['React', 'Node.js', 'WebRTC', 'Firebase', 'WebSockets', 'Docker'],
    link: 'https://github.com/adamdso',
    status: null,
  },
  {
    type: 'education',
    title: 'B.Sc. Computer Science',
    org: 'Arizona State University',
    date: "Jan '20 – Dec '23",
    location: 'Tempe, AZ',
    description:
      "GPA 3.64 · Dean's List · New American University Award. Coursework: Data Structures & Algorithms, iOS Mobile App Development, Operating Systems, Distributed Software Development, Software QA & Testing, Data Visualization.",
    tags: ['Algorithms', 'Operating Systems', 'Mobile Dev', 'Distributed Systems'],
    link: null,
    status: null,
  },
  {
    type: 'work',
    title: 'Frontend Engineering Intern',
    org: 'Etherea',
    date: "Jan '23 – Dec '23",
    location: 'Tempe, AZ',
    description:
      'Spearheaded iOS and Android feature development in React Native, driving a 40% increase in user engagement. Integrated Google Firestore handling up to 200,000 simultaneous connections and shipped Google OAuth. Delivered wellness-focused UI across mental health and sustainability categories on an Agile cadence.',
    tags: ['React Native', 'Firebase', 'Google Auth', 'iOS', 'Android', 'Agile'],
    link: null,
    status: 'Internship',
  },
  {
    type: 'education',
    title: 'Oracle Certified Associate — Java SE 8 Programmer',
    org: 'Oracle',
    date: '2023',
    location: null,
    description:
      'Industry certification validating core Java programming competency — OOP, data types, operators, exception handling, and the Java Collections framework.',
    tags: ['Java', 'OOP', 'Certification'],
    link: null,
    status: null,
  },
];

export default timelineEntries;
