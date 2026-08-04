// ---------- Tabs ----------
const tabs = document.querySelectorAll('.tab');
const panels = {
  scan: document.getElementById('panel-scan'),
  generate: document.getElementById('panel-generate'),
};
tabs.forEach((t) => {
  t.addEventListener('click', () => {
    tabs.forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    Object.entries(panels).forEach(([key, el]) => {
      el.hidden = key !== t.dataset.tab;
    });
  });
});

// ---------- Scan ----------
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const placeholder = document.getElementById('vfPlaceholder');
const scanResult = document.getElementById('scanResult');
const resultText = document.getElementById('resultText');
const openResult = document.getElementById('openResult');

let streaming = false;
let rafId = null;

document.getElementById('startCamera').addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    video.hidden = false;
    placeholder.hidden = true;
    scanResult.hidden = true;
    await video.play();
    streaming = true;
    tick();
  } catch (err) {
    placeholder.hidden = false;
    placeholder.textContent = "Camera unavailable — try uploading an image instead.";
  }
});

function tick() {
  if (!streaming) return;
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(frame.data, frame.width, frame.height);
    if (code) {
      handleDecoded(code.data);
      stopCamera();
      return;
    }
  }
  rafId = requestAnimationFrame(tick);
}

function stopCamera() {
  streaming = false;
  if (rafId) cancelAnimationFrame(rafId);
  const stream = video.srcObject;
  if (stream) stream.getTracks().forEach((t) => t.stop());
  video.hidden = true;
  placeholder.hidden = false;
  placeholder.textContent = "Code found. Tap 'Use camera' to scan another.";
}

document.getElementById('fileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(data.data, data.width, data.height);
    if (code) {
      handleDecoded(code.data);
    } else {
      scanResult.hidden = true;
      placeholder.hidden = false;
      placeholder.textContent = "Couldn't find a code in that image — try a clearer photo.";
    }
    URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
  e.target.value = ''; // allow re-selecting the same file to fire change again
});

function handleDecoded(text) {
  resultText.textContent = text;
  scanResult.hidden = false;
  if (/^https?:\/\//i.test(text.trim())) {
    openResult.href = text.trim();
    openResult.style.display = 'inline-flex';
  } else {
    openResult.style.display = 'none';
  }
}

document.getElementById('copyResult').addEventListener('click', () => {
  navigator.clipboard.writeText(resultText.textContent);
  const btn = document.getElementById('copyResult');
  const original = btn.textContent;
  btn.textContent = 'Copied';
  setTimeout(() => { btn.textContent = original; }, 1200);
});

// ---------- Generate ----------
const genInput = document.getElementById('genInput');
const genSize = document.getElementById('genSize');
const genEC = document.getElementById('genEC');
const qrOutput = document.getElementById('qrOutput');
const downloadBtn = document.getElementById('downloadBtn');

document.getElementById('genBtn').addEventListener('click', () => {
  const text = genInput.value.trim();
  if (!text) { genInput.focus(); return; }
  qrOutput.innerHTML = '';
  // eslint-disable-next-line no-undef
  new QRCode(qrOutput, {
    text,
    width: parseInt(genSize.value, 10),
    height: parseInt(genSize.value, 10),
    correctLevel: QRCode.CorrectLevel[genEC.value],
  });
  setTimeout(() => { downloadBtn.hidden = false; }, 80);
});

genInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('genBtn').click();
});

downloadBtn.addEventListener('click', () => {
  const canvasEl = qrOutput.querySelector('canvas');
  const imgEl = qrOutput.querySelector('img');
  const dataUrl = canvasEl ? canvasEl.toDataURL('image/png') : (imgEl ? imgEl.src : null);
  if (!dataUrl) return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'quiet-zone-qr.png';
  a.click();
});
