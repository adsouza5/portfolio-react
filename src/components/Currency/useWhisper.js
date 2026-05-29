import { useState, useRef, useCallback } from 'react';

// Module-level singleton so model persists across re-renders
let _transcriber = null;
let _loadPromise = null;

async function getTranscriber(onProgress) {
  if (_transcriber) return _transcriber;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    const { pipeline, env } = await import('@xenova/transformers');
    env.allowLocalModels = false;
    const t = await pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-tiny.en',
      { progress_callback: onProgress }
    );
    _transcriber = t;
    _loadPromise = null;
    return t;
  })();

  return _loadPromise;
}

// 'idle' | 'loading' | 'recording' | 'transcribing'
export function useWhisper({ onResult, onError }) {
  const [state, setState] = useState('idle');
  const [loadPct, setLoadPct] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const start = useCallback(async () => {
    setState('loading');

    let transcriber;
    try {
      transcriber = await getTranscriber((p) => {
        if (p.status === 'progress' && typeof p.progress === 'number') {
          setLoadPct(Math.round(p.progress));
        }
      });
    } catch (err) {
      setState('idle');
      onError('Failed to load voice model.');
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      setState('idle');
      onError('Microphone access denied.');
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setState('transcribing');

      try {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const float32 = audioBuffer.getChannelData(0);

        const output = await transcriber(float32, {
          language: 'english',
          task: 'transcribe',
        });

        const text = (output.text || '').trim();
        if (text) onResult(text);
        else onError('No speech detected — try again.');
      } catch {
        onError('Transcription failed — try again.');
      } finally {
        setState('idle');
      }
    };

    recorder.start();
    setState('recording');
  }, [onResult, onError]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const toggle = useCallback(() => {
    if (state === 'recording') stop();
    else if (state === 'idle') start();
  }, [state, start, stop]);

  return { state, loadPct, toggle };
}
