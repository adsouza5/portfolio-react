import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './CurrencyShowcase.css';

// ── Currency name → ISO code map ─────────────────────────────────
const CURRENCY_MAP = {
  dollar: 'USD', dollars: 'USD', usd: 'USD', 'us dollar': 'USD', 'us dollars': 'USD', 'american dollar': 'USD',
  euro: 'EUR', euros: 'EUR', eur: 'EUR',
  pound: 'GBP', pounds: 'GBP', gbp: 'GBP', sterling: 'GBP', 'british pound': 'GBP', 'british pounds': 'GBP',
  yen: 'JPY', jpy: 'JPY', 'japanese yen': 'JPY',
  yuan: 'CNY', cny: 'CNY', renminbi: 'CNY', rmb: 'CNY', 'chinese yuan': 'CNY',
  rupee: 'INR', rupees: 'INR', inr: 'INR', 'indian rupee': 'INR',
  franc: 'CHF', francs: 'CHF', chf: 'CHF', 'swiss franc': 'CHF',
  won: 'KRW', krw: 'KRW', 'korean won': 'KRW', 'south korean won': 'KRW',
  peso: 'MXN', pesos: 'MXN', mxn: 'MXN', 'mexican peso': 'MXN',
  real: 'BRL', reais: 'BRL', brl: 'BRL', 'brazilian real': 'BRL',
  'canadian dollar': 'CAD', cad: 'CAD', 'canadian dollars': 'CAD',
  'australian dollar': 'AUD', aud: 'AUD', 'australian dollars': 'AUD',
  'new zealand dollar': 'NZD', nzd: 'NZD',
  dirham: 'AED', aed: 'AED', 'uae dirham': 'AED',
  ruble: 'RUB', rubles: 'RUB', rub: 'RUB', 'russian ruble': 'RUB',
  lira: 'TRY', try: 'TRY', 'turkish lira': 'TRY',
  rand: 'ZAR', zar: 'ZAR', 'south african rand': 'ZAR',
  krona: 'SEK', sek: 'SEK', 'swedish krona': 'SEK',
  krone: 'NOK', nok: 'NOK', 'norwegian krone': 'NOK',
  'danish krone': 'DKK', dkk: 'DKK',
  'singapore dollar': 'SGD', sgd: 'SGD',
  'hong kong dollar': 'HKD', hkd: 'HKD',
  zloty: 'PLN', pln: 'PLN', 'polish zloty': 'PLN',
  forint: 'HUF', huf: 'HUF', 'hungarian forint': 'HUF',
  koruna: 'CZK', czk: 'CZK', 'czech koruna': 'CZK',
  'philippine peso': 'PHP', php: 'PHP',
  baht: 'THB', thb: 'THB', 'thai baht': 'THB',
  ringgit: 'MYR', myr: 'MYR', 'malaysian ringgit': 'MYR',
  rupiah: 'IDR', idr: 'IDR', 'indonesian rupiah': 'IDR',
  riyal: 'SAR', sar: 'SAR', 'saudi riyal': 'SAR',
};

const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', INR: '₹',
  KRW: '₩', BRL: 'R$', RUB: '₽', TRY: '₺', PLN: 'zł', THB: '฿',
  PHP: '₱', IDR: 'Rp', MYR: 'RM', SAR: '﷼', AED: 'د.إ',
};

const SUGGESTIONS = [
  '100 USD to EUR',
  '50 pounds to dollars',
  '1000 yen to rupees',
  '500 euros to Canadian dollars',
  'convert 200 AUD to GBP',
];

function resolveCurrency(raw) {
  const key = raw.trim().toLowerCase();
  return CURRENCY_MAP[key] || (key.length === 3 ? key.toUpperCase() : null);
}

function formatAmount(n, code) {
  const sym = CURRENCY_SYMBOLS[code] || '';
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: code === 'JPY' || code === 'KRW' || code === 'IDR' ? 0 : 2,
  }).format(n);
  return sym ? `${sym}${formatted}` : `${formatted} ${code}`;
}

function parseQuery(text) {
  const s = text.toLowerCase().replace(/[,]/g, '');

  // Build alternation of all known names + 3-letter codes
  const names = Object.keys(CURRENCY_MAP)
    .sort((a, b) => b.length - a.length) // longest first so "canadian dollar" beats "dollar"
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const codePattern = '[a-z]{3}';
  const currencyPattern = `(?:${names}|${codePattern})`;

  const re = new RegExp(
    `(\\d+(?:\\.\\d+)?)\\s+(${currencyPattern})\\s+(?:to|in|into)\\s+(${currencyPattern})`
  );
  const re2 = new RegExp(
    `(?:convert|change|exchange)?\\s*(\\d+(?:\\.\\d+)?)\\s+(${currencyPattern})\\s+(?:to|in|into)\\s+(${currencyPattern})`
  );

  const m = s.match(re2) || s.match(re);
  if (!m) return null;

  const amount = parseFloat(m[1]);
  const from = resolveCurrency(m[2]);
  const to = resolveCurrency(m[3]);
  if (!from || !to || from === to) return null;
  return { amount, from, to };
}

async function fetchConversion(amount, from, to) {
  const url = `https://api.frankfurter.app/latest?amount=${amount}&from=${from}&to=${to}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Rate fetch failed: ${res.status}`);
  const data = await res.json();
  const result = data.rates[to];
  if (result === undefined) throw new Error(`Unsupported pair: ${from}/${to}`);
  return { result, rate: result / amount, date: data.date };
}

let msgId = 0;
const mkId = () => ++msgId;

const WELCOME = {
  id: mkId(),
  role: 'bot',
  type: 'welcome',
  text: 'Ask me to convert any currency — type or speak naturally.',
};

export default function CurrencyShowcase() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSpeechSupported(false); return; }

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';

    let finalText = '';

    rec.onstart = () => { setListening(true); finalText = ''; };

    rec.onresult = (e) => {
      let interim = '';
      finalText = '';
      for (const result of e.results) {
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      setTranscript(finalText || interim);
      if (finalText) setInput(finalText.trim());
    };

    rec.onend = () => {
      setListening(false);
      setTranscript('');
      if (finalText.trim()) {
        handleSend(finalText.trim());
        finalText = '';
      }
    };

    rec.onerror = () => { setListening(false); setTranscript(''); };

    recognitionRef.current = rec;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const addMessage = (msg) => setMessages(prev => [...prev, { id: mkId(), ...msg }]);

  const handleSend = useCallback(async (text) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    inputRef.current?.focus();

    addMessage({ role: 'user', type: 'text', text: q });

    const parsed = parseQuery(q);
    if (!parsed) {
      addMessage({
        role: 'bot',
        type: 'error',
        text: 'Try something like "100 USD to EUR" or "50 pounds to yen".',
      });
      return;
    }

    setLoading(true);
    try {
      const { result, rate, date } = await fetchConversion(parsed.amount, parsed.from, parsed.to);
      addMessage({ role: 'bot', type: 'result', amount: parsed.amount, from: parsed.from, to: parsed.to, result, rate, date });
    } catch {
      addMessage({ role: 'bot', type: 'error', text: 'Could not fetch live rate. The currency pair may not be supported.' });
    } finally {
      setLoading(false);
    }
  }, [input, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMic = () => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
    } else {
      setInput('');
      rec.start();
    }
  };

  const handleFlip = async (msg) => {
    if (loading) return;
    const q = `${msg.result.toFixed(2)} ${msg.to} to ${msg.from}`;
    handleSend(q);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="fx-root">
      {/* Nav */}
      <nav className="fx-nav">
        <button className="fx-back" onClick={() => navigate('/')}>← Back</button>
        <span className="fx-nav-title">Currency Converter</span>
        <span className="fx-nav-badge">Live · Frankfurter</span>
      </nav>

      <div className="fx-layout">
        {/* Header */}
        <header className="fx-header">
          <h1>Currency Converter</h1>
          <p>Type or speak — live exchange rates, any pair</p>
        </header>

        {/* Chat */}
        <div className="fx-chat">
          {messages.map(msg => (
            <div key={msg.id} className={`fx-msg fx-msg--${msg.role}`}>
              {msg.type === 'welcome' && (
                <div className="fx-bubble">
                  <div>{msg.text}</div>
                  <div className="fx-suggestions">
                    {SUGGESTIONS.map(s => (
                      <button key={s} className="fx-suggestion" onClick={() => handleSend(s)}>{s}</button>
                    ))}
                  </div>
                </div>
              )}

              {msg.type === 'text' && (
                <div className="fx-bubble">{msg.text}</div>
              )}

              {msg.type === 'error' && (
                <div className="fx-bubble fx-error">{msg.text}</div>
              )}

              {msg.type === 'result' && (
                <div className="fx-bubble">
                  <div className="fx-result">
                    <div className="fx-result-amount">
                      {formatAmount(msg.result, msg.to)}{' '}
                      <span>{msg.to}</span>
                    </div>
                    <div className="fx-result-rate">
                      {formatAmount(msg.amount, msg.from)} {msg.from} = {formatAmount(msg.result, msg.to)} {msg.to}
                    </div>
                    <div className="fx-result-rate">
                      1 {msg.from} = {msg.rate.toFixed(msg.rate < 0.01 ? 6 : 4)} {msg.to}
                    </div>
                    <div className="fx-result-meta">
                      <span className="fx-result-date">Rate as of {msg.date}</span>
                      <button className="fx-flip-btn" onClick={() => handleFlip(msg)}>⇄ Reverse</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="fx-msg fx-msg--bot">
              <div className="fx-bubble">
                <div className="fx-typing">
                  <div className="fx-dot" />
                  <div className="fx-dot" />
                  <div className="fx-dot" />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="fx-input-area">
          {listening && transcript && (
            <div className="fx-transcript">"{transcript}"</div>
          )}
          <div className="fx-input-row">
            <input
              ref={inputRef}
              className="fx-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={listening ? 'Listening...' : 'Convert 100 USD to EUR…'}
              disabled={listening}
            />
            {speechSupported && (
              <button
                className={`fx-mic${listening ? ' fx-mic--listening' : ''}`}
                onClick={toggleMic}
                title={listening ? 'Stop listening' : 'Speak'}
              >
                {listening ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
                  </svg>
                )}
              </button>
            )}
            <button
              className="fx-send"
              onClick={() => handleSend()}
              disabled={!input.trim() || loading || listening}
              title="Send"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
              </svg>
            </button>
          </div>
          {!speechSupported && (
            <div className="fx-unsupported">Voice input not supported in this browser. Try Chrome or Edge.</div>
          )}
        </div>
      </div>
    </div>
  );
}
