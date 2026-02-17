// ============================================================
// MORSE MAPS
// ============================================================

const MORSE_MAP = {
  'A': '.-',    'B': '-...',  'C': '-.-.',  'D': '-..',
  'E': '.',     'F': '..-.',  'G': '--.',   'H': '....',
  'I': '..',    'J': '.---',  'K': '-.-',   'L': '.-..',
  'M': '--',    'N': '-.',    'O': '---',   'P': '.--.',
  'Q': '--.-',  'R': '.-.',   'S': '...',   'T': '-',
  'U': '..-',   'V': '...-',  'W': '.--',   'X': '-..-',
  'Y': '-.--',  'Z': '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--',
  '4': '....-', '5': '.....', '6': '-....', '7': '--...',
  '8': '---..', '9': '----.',
  ' ': '/'
};

const REVERSE_MORSE_MAP = {};
for (const [ch, code] of Object.entries(MORSE_MAP)) {
  if (ch !== ' ') REVERSE_MORSE_MAP[code] = ch;
}

const FREQ = 700;
const GAIN_LEVEL = 0.5;

// ============================================================
// DOM ELEMENTS — TRANSLATOR
// ============================================================

const textInput = document.getElementById('text-input');
const charCounter = document.getElementById('char-counter');
const errorMsg = document.getElementById('error-msg');
const morseInput = document.getElementById('morse-input');
const morseErrorMsg = document.getElementById('morse-error-msg');
const wpmSlider = document.getElementById('wpm-slider');
const wpmValue = document.getElementById('wpm-value');
const playBtn = document.getElementById('play-btn');
const stopBtn = document.getElementById('stop-btn');
const downloadBtn = document.getElementById('download-btn');
const copyTextBtn = document.getElementById('copy-text-btn');
const copyMorseBtn = document.getElementById('copy-morse-btn');

// DOM ELEMENTS — TABS
const tabBtns = document.querySelectorAll('.tab-btn');
const tabTranslator = document.getElementById('tab-translator');
const tabDecoder = document.getElementById('tab-decoder');

// DOM ELEMENTS — DECODER
const uploadBtn = document.getElementById('upload-btn');
const audioFileInput = document.getElementById('audio-file-input');
const fileNameSpan = document.getElementById('file-name');
const decoderWpmSlider = document.getElementById('decoder-wpm-slider');
const decoderWpmValue = document.getElementById('decoder-wpm-value');
const freqSlider = document.getElementById('freq-slider');
const freqValue = document.getElementById('freq-value');
const thresholdSlider = document.getElementById('threshold-slider');
const thresholdValue = document.getElementById('threshold-value');
const decodeBtn = document.getElementById('decode-btn');
const decoderCanvas = document.getElementById('decoder-canvas');
const vizSection = document.querySelector('.visualization-section');
const decoderOutputSection = document.querySelector('.decoder-output-section');
const decodedMorseArea = document.getElementById('decoded-morse');
const decodedTextArea = document.getElementById('decoded-text');

// ============================================================
// STATE
// ============================================================

let audioCtx = null;
let isPlaying = false;
let stopRequested = false;
let currentSource = null;
let isUpdating = false;
let decoderAudioBuffer = null;
let lastMagnitudes = null;

// ============================================================
// TAB SWITCHING
// ============================================================

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (tab === 'translator') {
      tabTranslator.hidden = false;
      tabDecoder.hidden = true;
    } else {
      tabTranslator.hidden = true;
      tabDecoder.hidden = false;
    }

    // Stop audio on tab switch
    if (isPlaying) stopRequested = true;
  });
});

// ============================================================
// CONVERSION FUNCTIONS
// ============================================================

function validateAndConvert(text) {
  const upper = text.toUpperCase();
  const invalid = [];
  for (const ch of upper) {
    if (!(ch in MORSE_MAP)) {
      if (!invalid.includes(ch)) invalid.push(ch);
    }
  }
  return { upper, invalid };
}

function textToMorse(text) {
  return text.split('').map(ch => MORSE_MAP[ch]).join(' ');
}

function morseToText(morse) {
  const trimmed = morse.trim();
  if (!trimmed) return '';

  const words = trimmed.split(/\s*\/\s*/);
  const result = [];
  const invalid = [];

  for (const word of words) {
    if (!word.trim()) {
      result.push(' ');
      continue;
    }
    const letters = word.trim().split(/\s+/);
    for (const code of letters) {
      if (!code) continue;
      if (code in REVERSE_MORSE_MAP) {
        result.push(REVERSE_MORSE_MAP[code]);
      } else {
        if (!invalid.includes(code)) invalid.push(code);
        result.push('?');
      }
    }
    result.push(' ');
  }

  // Remove trailing space
  if (result.length > 0 && result[result.length - 1] === ' ') {
    result.pop();
  }

  return { text: result.join(''), invalid };
}

// ============================================================
// BIDIRECTIONAL INPUT HANDLERS
// ============================================================

function updateButtonStates() {
  const morse = morseInput.value.trim();
  const hasContent = morse.length > 0;
  // Check if morse only contains valid chars
  const morseOnly = /^[.\-\s/]*$/.test(morse);
  playBtn.disabled = !hasContent || !morseOnly;
  downloadBtn.disabled = !hasContent || !morseOnly;
}

textInput.addEventListener('input', () => {
  if (isUpdating) return;
  isUpdating = true;

  const len = textInput.value.length;
  charCounter.textContent = `${len} / 140`;

  const { upper, invalid } = validateAndConvert(textInput.value);

  if (invalid.length > 0) {
    errorMsg.textContent = `UNSUPPORTED: ${invalid.map(c => `"${c}"`).join(', ')}`;
    errorMsg.hidden = false;
  } else {
    errorMsg.hidden = true;
  }

  if (upper.trim().length > 0 && invalid.length === 0) {
    morseInput.value = textToMorse(upper);
    morseErrorMsg.hidden = true;
  } else if (upper.trim().length === 0) {
    morseInput.value = '';
    morseErrorMsg.hidden = true;
  }

  updateButtonStates();
  isUpdating = false;
});

morseInput.addEventListener('input', () => {
  if (isUpdating) return;
  isUpdating = true;

  const raw = morseInput.value;

  // Check for characters that aren't valid morse
  const invalidChars = raw.replace(/[.\-\s/]/g, '');
  if (invalidChars.length > 0) {
    const unique = [...new Set(invalidChars)];
    morseErrorMsg.textContent = `INVALID CHARS: ${unique.map(c => `"${c}"`).join(', ')}`;
    morseErrorMsg.hidden = false;
    textInput.value = '';
    charCounter.textContent = '0 / 140';
    errorMsg.hidden = true;
    updateButtonStates();
    isUpdating = false;
    return;
  }

  if (raw.trim().length === 0) {
    textInput.value = '';
    charCounter.textContent = '0 / 140';
    morseErrorMsg.hidden = true;
    errorMsg.hidden = true;
    updateButtonStates();
    isUpdating = false;
    return;
  }

  const { text, invalid } = morseToText(raw);

  if (invalid.length > 0) {
    morseErrorMsg.textContent = `UNKNOWN CODES: ${invalid.map(c => `"${c}"`).join(', ')}`;
    morseErrorMsg.hidden = false;
  } else {
    morseErrorMsg.hidden = true;
  }

  textInput.value = text;
  charCounter.textContent = `${text.length} / 140`;
  errorMsg.hidden = true;

  updateButtonStates();
  isUpdating = false;
});

// ============================================================
// COPY TO CLIPBOARD
// ============================================================

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = 'COPIED!';
    setTimeout(() => { btn.textContent = original; }, 1500);
  });
}

copyTextBtn.addEventListener('click', () => {
  copyToClipboard(textInput.value, copyTextBtn);
});

copyMorseBtn.addEventListener('click', () => {
  copyToClipboard(morseInput.value, copyMorseBtn);
});

// ============================================================
// WPM SLIDER
// ============================================================

wpmSlider.addEventListener('input', () => {
  wpmValue.textContent = wpmSlider.value;
});

// ============================================================
// MORSE TIMING
// ============================================================

function getTimings(wpm) {
  const dot = 1200 / wpm;
  return {
    dot: dot / 1000,
    dash: (dot * 3) / 1000,
    symbolGap: dot / 1000,
    letterGap: (dot * 3) / 1000,
    wordGap: (dot * 7) / 1000
  };
}

// ============================================================
// AUDIO PLAYBACK
// ============================================================

function ensureAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function buildSchedule(morseString, wpm) {
  const t = getTimings(wpm);
  const schedule = [];
  let time = 0;

  const chars = morseString.split(' ');
  for (let i = 0; i < chars.length; i++) {
    const symbol = chars[i];

    if (symbol === '/') {
      time += t.wordGap - t.letterGap;
      continue;
    }

    if (symbol.length === 0) continue;

    for (let j = 0; j < symbol.length; j++) {
      const duration = symbol[j] === '.' ? t.dot : t.dash;
      schedule.push({ start: time, duration });
      time += duration + t.symbolGap;
    }

    time -= t.symbolGap;
    time += t.letterGap;
  }

  if (chars.length > 0) {
    time -= t.letterGap;
  }

  return { schedule, totalDuration: time };
}

async function playMorse() {
  const morse = morseInput.value.trim();
  if (!morse || !/^[.\-\s/]+$/.test(morse)) return;

  const ctx = ensureAudioCtx();
  const wpm = parseInt(wpmSlider.value);
  const { schedule, totalDuration } = buildSchedule(morse, wpm);

  isPlaying = true;
  stopRequested = false;
  playBtn.disabled = true;
  stopBtn.disabled = false;
  downloadBtn.disabled = true;

  const gainNode = ctx.createGain();
  gainNode.gain.value = GAIN_LEVEL;
  gainNode.connect(ctx.destination);

  const now = ctx.currentTime + 0.05;
  const oscillators = [];

  for (const { start, duration } of schedule) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = FREQ;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now + start);
    env.gain.linearRampToValueAtTime(1, now + start + 0.005);
    env.gain.setValueAtTime(1, now + start + duration - 0.005);
    env.gain.linearRampToValueAtTime(0, now + start + duration);

    osc.connect(env);
    env.connect(gainNode);
    osc.start(now + start);
    osc.stop(now + start + duration);
    oscillators.push(osc);
  }

  currentSource = { oscillators, gainNode };

  return new Promise(resolve => {
    const checkStop = setInterval(() => {
      if (stopRequested) {
        clearInterval(checkStop);
        stopPlayback();
        resolve();
      }
    }, 50);

    setTimeout(() => {
      clearInterval(checkStop);
      if (!stopRequested) {
        finishPlayback();
      }
      resolve();
    }, (totalDuration + 0.1) * 1000);
  });
}

function stopPlayback() {
  if (currentSource) {
    try {
      currentSource.oscillators.forEach(osc => {
        try { osc.stop(); } catch {}
      });
      currentSource.gainNode.disconnect();
    } catch {}
    currentSource = null;
  }
  finishPlayback();
}

function finishPlayback() {
  isPlaying = false;
  stopRequested = false;
  playBtn.disabled = false;
  stopBtn.disabled = true;
  downloadBtn.disabled = false;
}

playBtn.addEventListener('click', () => {
  if (!isPlaying) playMorse();
});

stopBtn.addEventListener('click', () => {
  if (isPlaying) stopRequested = true;
});

// ============================================================
// MP3 DOWNLOAD
// ============================================================

function generatePCM(morse, wpm, sampleRate) {
  const { schedule, totalDuration } = buildSchedule(morse, wpm);
  const numSamples = Math.ceil(totalDuration * sampleRate);
  const samples = new Int16Array(numSamples);

  for (const { start, duration } of schedule) {
    const startSample = Math.floor(start * sampleRate);
    const endSample = Math.min(Math.floor((start + duration) * sampleRate), numSamples);
    const rampSamples = Math.floor(0.005 * sampleRate);

    for (let i = startSample; i < endSample; i++) {
      const t = i / sampleRate;
      let amplitude = Math.sin(2 * Math.PI * FREQ * t);

      const posInTone = i - startSample;
      const toneLen = endSample - startSample;
      if (posInTone < rampSamples) {
        amplitude *= posInTone / rampSamples;
      } else if (posInTone > toneLen - rampSamples) {
        amplitude *= (toneLen - posInTone) / rampSamples;
      }

      samples[i] = Math.floor(amplitude * GAIN_LEVEL * 32767);
    }
  }

  return samples;
}

downloadBtn.addEventListener('click', () => {
  const morse = morseInput.value.trim();
  if (!morse || !/^[.\-\s/]+$/.test(morse)) return;

  const wpm = parseInt(wpmSlider.value);
  const sampleRate = 44100;

  const samples = generatePCM(morse, wpm, sampleRate);

  const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
  const mp3Data = [];
  const blockSize = 1152;

  for (let i = 0; i < samples.length; i += blockSize) {
    const chunk = samples.subarray(i, i + blockSize);
    const mp3buf = mp3encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) mp3Data.push(mp3buf);
  }

  const end = mp3encoder.flush();
  if (end.length > 0) mp3Data.push(end);

  const blob = new Blob(mp3Data, { type: 'audio/mp3' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'morse-code.mp3';
  a.click();
  URL.revokeObjectURL(url);
});

// ============================================================
// AUDIO DECODER — FILE UPLOAD
// ============================================================

uploadBtn.addEventListener('click', () => {
  audioFileInput.click();
});

audioFileInput.addEventListener('change', async () => {
  const file = audioFileInput.files[0];
  if (!file) return;

  fileNameSpan.textContent = file.name;
  decodeBtn.disabled = true;
  vizSection.hidden = true;
  decoderOutputSection.hidden = true;
  decodedMorseArea.value = '';
  decodedTextArea.value = '';
  lastMagnitudes = null;

  try {
    const ctx = ensureAudioCtx();
    const arrayBuffer = await file.arrayBuffer();
    decoderAudioBuffer = await ctx.decodeAudioData(arrayBuffer);
    decodeBtn.disabled = false;
  } catch (err) {
    fileNameSpan.textContent = 'ERROR: COULD NOT DECODE AUDIO';
    decoderAudioBuffer = null;
  }
});

// ============================================================
// DECODER — WPM / THRESHOLD SLIDERS
// ============================================================

decoderWpmSlider.addEventListener('input', () => {
  decoderWpmValue.textContent = decoderWpmSlider.value;
});

freqSlider.addEventListener('input', () => {
  freqValue.textContent = freqSlider.value;
});

thresholdSlider.addEventListener('input', () => {
  thresholdValue.textContent = thresholdSlider.value;
  if (lastMagnitudes) {
    drawVisualization(lastMagnitudes, parseInt(thresholdSlider.value) / 100);
  }
});

// ============================================================
// GOERTZEL ALGORITHM
// ============================================================

function goertzelMagnitude(samples, targetFreq, sampleRate) {
  const N = samples.length;
  const k = Math.round(N * targetFreq / sampleRate);
  const w = (2 * Math.PI * k) / N;
  const coeff = 2 * Math.cos(w);

  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < N; i++) {
    s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }

  return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2) / N;
}

function analyzeAudio(audioBuffer, windowMs, targetFreq) {
  // Mix to mono
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const mono = new Float32Array(length);

  for (let ch = 0; ch < numChannels; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += data[i] / numChannels;
    }
  }

  const windowSize = Math.floor(sampleRate * windowMs / 1000);
  const numWindows = Math.floor(length / windowSize);
  const magnitudes = new Float32Array(numWindows);

  for (let w = 0; w < numWindows; w++) {
    const start = w * windowSize;
    const chunk = mono.subarray(start, start + windowSize);
    magnitudes[w] = goertzelMagnitude(chunk, targetFreq, sampleRate);
  }

  return magnitudes;
}

// ============================================================
// DECODER — VISUALIZATION
// ============================================================

function drawVisualization(magnitudes, thresholdPct) {
  const canvas = decoderCanvas;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  ctx.fillRect(0, 0, w, h);

  const maxMag = Math.max(...magnitudes);
  if (maxMag === 0) return;

  const threshold = maxMag * thresholdPct;
  const barWidth = Math.max(1, w / magnitudes.length);

  const brassColor = getComputedStyle(document.documentElement).getPropertyValue('--brass').trim();
  const dimColor = getComputedStyle(document.documentElement).getPropertyValue('--brass-dim').trim();
  const padding = 4;

  for (let i = 0; i < magnitudes.length; i++) {
    const val = magnitudes[i] / maxMag;
    const barH = val * (h - padding * 2);
    const x = (i / magnitudes.length) * w;
    const y = h - padding - barH;

    ctx.fillStyle = magnitudes[i] >= threshold ? brassColor : dimColor;
    ctx.fillRect(x, y, barWidth + 0.5, barH);
  }

  // Threshold line
  const threshY = h - padding - (thresholdPct * (h - padding * 2));
  ctx.strokeStyle = '#a04030';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, threshY);
  ctx.lineTo(w, threshY);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ============================================================
// DECODER — SEGMENT CLASSIFICATION
// ============================================================

function classifySegments(magnitudes, thresholdPct, windowMs, wpm) {
  const maxMag = Math.max(...magnitudes);
  if (maxMag === 0) return '';

  const threshold = maxMag * thresholdPct;
  const t = getTimings(wpm);

  // Convert magnitudes to on/off runs
  const runs = [];
  let currentOn = magnitudes[0] >= threshold;
  let runStart = 0;

  for (let i = 1; i <= magnitudes.length; i++) {
    const on = i < magnitudes.length ? magnitudes[i] >= threshold : !currentOn;
    if (on !== currentOn) {
      runs.push({
        on: currentOn,
        startIdx: runStart,
        length: i - runStart,
        durationSec: (i - runStart) * windowMs / 1000
      });
      currentOn = on;
      runStart = i;
    }
  }

  // Classify ON segments as dit or dah, OFF segments as symbol/letter/word gap
  const dotDuration = t.dot;
  const dashDuration = t.dash;
  const ditDahThreshold = (dotDuration + dashDuration) / 2;
  const letterGapThreshold = (t.symbolGap + t.letterGap) / 2;
  const wordGapThreshold = (t.letterGap + t.wordGap) / 2;

  let morse = '';

  for (const run of runs) {
    if (run.on) {
      morse += run.durationSec < ditDahThreshold ? '.' : '-';
    } else {
      if (run.durationSec >= wordGapThreshold) {
        morse += ' / ';
      } else if (run.durationSec >= letterGapThreshold) {
        morse += ' ';
      }
      // symbol gap: no separator needed (dots/dashes in same letter are adjacent)
    }
  }

  return morse.trim();
}

// ============================================================
// DECODER — DECODE BUTTON
// ============================================================

decodeBtn.addEventListener('click', () => {
  if (!decoderAudioBuffer) return;

  const windowMs = 10;
  const wpm = parseInt(decoderWpmSlider.value);
  const targetFreq = parseInt(freqSlider.value);
  const thresholdPct = parseInt(thresholdSlider.value) / 100;

  const magnitudes = analyzeAudio(decoderAudioBuffer, windowMs, targetFreq);
  lastMagnitudes = magnitudes;

  // Draw visualization
  vizSection.hidden = false;
  drawVisualization(magnitudes, thresholdPct);

  // Classify and decode
  const morse = classifySegments(magnitudes, thresholdPct, windowMs, wpm);
  decodedMorseArea.value = morse;

  if (morse) {
    const { text } = morseToText(morse);
    decodedTextArea.value = text;
  } else {
    decodedTextArea.value = '';
  }

  decoderOutputSection.hidden = false;
});
