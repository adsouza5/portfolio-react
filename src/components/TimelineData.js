// Source of truth: Adam Dsouza resume (as of 2024)
// type: 'project' | 'work' | 'education'

const timelineEntries = [
  {
    type: 'project',
    title: 'Prism — API Gateway with Auth & Rate Limiting',
    org: null,
    date: '2026',
    location: null,
    description:
      'Production-grade API gateway with JWT authentication, per-client sliding-window rate limiting, and intelligent request routing. Built in Go with a reverse proxy core, a WebSocket-powered live admin dashboard, and a React UI showing real-time traffic, client quota usage, and JWT token inspection. Deployed on Cloud Run.',
    tags: ['Go', 'JWT', 'Rate Limiting', 'Reverse Proxy', 'WebSockets', 'React', 'Cloud Run', 'Docker'],
    link: 'https://github.com/adsouza5/prism-api',
    status: null,
    showcase: 'Prism',
  },
  {
    type: 'project',
    title: 'Lens — Semantic Code Search Engine',
    org: null,
    date: '2026',
    location: null,
    description:
      'Index any GitHub repository and query it in plain English. Code is chunked with tree-sitter (function/class level), embedded using your choice of model — jina-embeddings-v2-base-code (self-hosted), OpenAI text-embedding-3-small, or Ollama (fully local) — and stored in Qdrant for sub-second vector similarity search. Results include file path, line numbers, symbol name, and relevance score.',
    tags: ['Python', 'FastAPI', 'Qdrant', 'tree-sitter', 'sentence-transformers', 'OpenAI', 'React', 'Cloud Run'],
    link: 'https://github.com/adsouza5/lens-api',
    status: null,
    showcase: 'Lens',
  },
  {
    type: 'project',
    title: 'Sentinel — Real-Time ML Inference Pipeline',
    org: null,
    date: '2026',
    location: null,
    description:
      'Serverless GCP pipeline that streams live market data through Pub/Sub, extracts technical indicators (RSI, MACD, Bollinger Bands, ATR) on Cloud Run, and runs a trained ML classifier to produce BULLISH/BEARISH/NEUTRAL signals with confidence scores. Predictions land in BigQuery, session state is managed in Firestore, and results are served via FastAPI — all provisioned with Terraform.',
    tags: ['Cloud Run', 'Pub/Sub', 'BigQuery', 'Firestore', 'Terraform', 'Python', 'FastAPI', 'scikit-learn'],
    link: 'https://github.com/adsouza5/sentinel-ml-pipeline',
    status: null,
    showcase: 'MLPipelineShowcase',
  },
  {
    type: 'work',
    title: 'Software Developer',
    org: 'Synechron',
    date: "Mar '24 – Present",
    location: 'New York, NY',
    description:
      'Engineered a production-grade OCR pipeline (Python, OpenCV, Tesseract) increasing digitization throughput by 40%. Delivered a high-priority client demo under a one-week deadline — owning the React frontend layer while coordinating cross-functional execution to ship on time. Owned end-to-end frontend delivery for a large-scale enterprise client — scoping and delivering 350+ feature requests directly with stakeholders. Spearheaded Java → Kotlin modernization cutting build time by 25% and maintainability overhead by 20%.',
    tags: ['Python', 'OpenCV', 'Tesseract', 'React', 'Node.js', 'Kotlin', 'Java'],
    link: null,
    status: null,
  },
  {
    type: 'project',
    title: 'Flux — Universal Unit Converter',
    org: null,
    date: '2024',
    location: null,
    description:
      'Universal converter spanning 17 measurement types — length, mass, temperature, volume, speed, area, time, digital storage, pressure, energy, power, frequency, angle, force, torque, fuel economy, and live currency exchange. Understands natural language queries typed or spoken via in-browser Whisper (audio never leaves the device). Hundreds of units, real-time Frankfurter currency rates, and a dynamic audio-reactive visualizer that shifts color per conversion type.',
    tags: ['React', 'Whisper', 'Web Audio API', 'Frankfurter', 'NLP', 'Voice UI'],
    link: 'https://github.com/adsouza5/currency-convert-chatbot',
    status: null,
    showcase: 'Flux',
  },
  {
    type: 'project',
    title: 'CodeCollab — Real-Time Collaborative Editor',
    org: null,
    date: '2023',
    location: null,
    description:
      'Segment-based real-time collaborative editor — each user owns a named code segment with a unique colour, editable only by them and read-only for others. Eliminates merge conflicts by design. Shared state is synced via Y.js (CRDT) over a y-websocket relay deployed on Render. Monaco Editor powers the coding experience with per-owner colour decorations and read-only enforcement. Judge0 CE handles sandboxed multi-language execution (JS, TS, Python, Go, Rust, Java) with TLE and compile-error surfacing. Sessions are passcode-protected using client-side SHA-256 hashing.',
    tags: ['React', 'Y.js', 'CRDT', 'Monaco Editor', 'Judge0', 'WebSockets', 'Node.js'],
    link: 'https://github.com/adsouza5/RealTimeCoding',
    status: null,
    showcase: 'CodeCollab',
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
