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

const FREQ = 700;
const GAIN_LEVEL = 0.5;

// DOM elements
const textInput = document.getElementById('text-input');
const charCounter = document.getElementById('char-counter');
const errorMsg = document.getElementById('error-msg');
const outputSection = document.getElementById('output-section');
const morseOutput = document.getElementById('morse-output');
const copyBtn = document.getElementById('copy-btn');
const wpmSlider = document.getElementById('wpm-slider');
const wpmValue = document.getElementById('wpm-value');
const playBtn = document.getElementById('play-btn');
const stopBtn = document.getElementById('stop-btn');
const downloadBtn = document.getElementById('download-btn');

let audioCtx = null;
let isPlaying = false;
let stopRequested = false;
let currentSource = null;

// --- Input handling ---

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

textInput.addEventListener('input', () => {
  const len = textInput.value.length;
  charCounter.textContent = `${len} / 140`;

  const { upper, invalid } = validateAndConvert(textInput.value);

  if (invalid.length > 0) {
    errorMsg.textContent = `UNSUPPORTED: ${invalid.map(c => `"${c}"`).join(', ')}`;
    errorMsg.hidden = false;
  } else {
    errorMsg.hidden = true;
  }

  const hasValidInput = upper.trim().length > 0 && invalid.length === 0;
  playBtn.disabled = !hasValidInput;
  downloadBtn.disabled = !hasValidInput;

  if (hasValidInput) {
    outputSection.hidden = false;
    morseOutput.textContent = textToMorse(upper);
  } else {
    outputSection.hidden = true;
    morseOutput.textContent = '';
  }
});

// --- WPM slider ---

wpmSlider.addEventListener('input', () => {
  wpmValue.textContent = wpmSlider.value;
});

// --- Copy button ---

copyBtn.addEventListener('click', async () => {
  const text = morseOutput.textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    const original = copyBtn.textContent;
    copyBtn.textContent = 'COPIED!';
    setTimeout(() => { copyBtn.textContent = original; }, 1500);
  } catch {
    // Fallback
    const range = document.createRange();
    range.selectNodeContents(morseOutput);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('copy');
    sel.removeAllRanges();
    copyBtn.textContent = 'COPIED!';
    setTimeout(() => { copyBtn.textContent = 'COPY'; }, 1500);
  }
});

// --- Morse timing ---

function getTimings(wpm) {
  // Standard PARIS timing: dot = 1200ms / WPM
  const dot = 1200 / wpm;
  return {
    dot: dot / 1000,          // seconds
    dash: (dot * 3) / 1000,
    symbolGap: dot / 1000,     // gap between dots/dashes within a letter
    letterGap: (dot * 3) / 1000, // gap between letters
    wordGap: (dot * 7) / 1000   // gap between words
  };
}

// --- Audio playback ---

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
      // Word gap: we already have a letterGap pending, add extra to reach wordGap
      time += t.wordGap - t.letterGap;
      continue;
    }

    if (symbol.length === 0) continue;

    for (let j = 0; j < symbol.length; j++) {
      const duration = symbol[j] === '.' ? t.dot : t.dash;
      schedule.push({ start: time, duration });
      time += duration + t.symbolGap;
    }

    // Remove trailing symbolGap after the last dot/dash in the letter
    time -= t.symbolGap;
    // Add letterGap
    time += t.letterGap;
  }

  // Remove trailing letterGap
  if (chars.length > 0) {
    time -= t.letterGap;
  }

  return { schedule, totalDuration: time };
}

async function playMorse() {
  const { upper, invalid } = validateAndConvert(textInput.value);
  if (invalid.length > 0 || upper.trim().length === 0) return;

  const ctx = ensureAudioCtx();
  const morse = textToMorse(upper);
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

  // Wait for playback to finish
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

// --- MP3 Download ---

function generatePCM(morse, wpm, sampleRate) {
  const { schedule, totalDuration } = buildSchedule(morse, wpm);
  const numSamples = Math.ceil(totalDuration * sampleRate);
  const samples = new Int16Array(numSamples);

  for (const { start, duration } of schedule) {
    const startSample = Math.floor(start * sampleRate);
    const endSample = Math.min(Math.floor((start + duration) * sampleRate), numSamples);
    const rampSamples = Math.floor(0.005 * sampleRate); // 5ms ramp

    for (let i = startSample; i < endSample; i++) {
      const t = i / sampleRate;
      let amplitude = Math.sin(2 * Math.PI * FREQ * t);

      // Apply envelope
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
  const { upper, invalid } = validateAndConvert(textInput.value);
  if (invalid.length > 0 || upper.trim().length === 0) return;

  const morse = textToMorse(upper);
  const wpm = parseInt(wpmSlider.value);
  const sampleRate = 44100;

  const samples = generatePCM(morse, wpm, sampleRate);

  // Encode to MP3 using lamejs
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
