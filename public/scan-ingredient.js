// /public/scan-ingredient.js

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM refs (must match IDs in your HTML) ---
  const uploadBtn  = document.getElementById('upload-picture');
  const takeBtn    = document.getElementById('take-picture');
  const fileInput  = document.getElementById('file-input');
  const preview    = document.getElementById('preview');
  const previewImg = document.getElementById('preview-img');
  const scanBtn    = document.getElementById('scan');
  const resultPre  = document.getElementById('result');
  const formEl     = document.getElementById('scan-ingredient-form');

  // --- Config: change if your Flask server runs elsewhere ---
  const API_BASE = `http://${window.location.hostname}:8080`;

  // --- Helpers ---
  function setUploading(isUploading) {
    if (!scanBtn) return;
    scanBtn.disabled = isUploading;
    scanBtn.textContent = isUploading ? 'Scanning…' : 'Scan Ingredients';
  }

  function showPreviewFromBlob(blob) {
    const url = URL.createObjectURL(blob);
    previewImg.src = url;
    preview.style.display = 'block';
  }

  async function blobToFileInput(blob, filename = 'capture.png', mime = 'image/png') {
    const file = new File([blob], filename, { type: mime });
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
  }

  async function dataUrlToBlob(dataUrl) {
    const res = await fetch(dataUrl);
    return await res.blob();
  }

  function renderScanResults(data) {
    if (!data || !data.analysis || !Array.isArray(data.analysis)) {
      resultPre.innerHTML = '<span style="color:red">No results found.</span>';
      return;
    }
    let html = `<div class="scan-results-cards"><h2>Scan Results</h2>`;
    for (const item of data.analysis) {
      let hazardIcon = '';
      switch ((item.hazard_level || '').toLowerCase()) {
        case 'high': hazardIcon = '⚠️'; break;
        case 'medium': hazardIcon = '🟠'; break;
        case 'low': hazardIcon = '🟢'; break;
        default: hazardIcon = '❔';
      }
      html += `<div class="scan-card">
        <div class="scan-card-header">
          <span class="scan-card-name">${item.name || item.query || '-'}</span>
          <span class="scan-card-hazard hazard-${(item.hazard_level || 'unknown').toLowerCase()}">${hazardIcon} ${item.hazard_level || '-'}</span>
        </div>
        <div class="scan-card-body">
          <span class="scan-card-recommend">${item.recommendation || '-'}</span>
        </div>
      </div>`;
    }
    html += `</div>`;
    // Optionally show summary
    if (data.summary && data.summary.health) {
      html += `<div class="scan-summary">
        <strong>Summary:</strong><br>
        <span class="summary-high">⚠️ High: ${data.summary.health.high}</span>, 
        <span class="summary-medium">🟠 Medium: ${data.summary.health.medium}</span>, 
        <span class="summary-low">🟢 Low: ${data.summary.health.low}</span>, 
        <span class="summary-unknown">❔ Unknown: ${data.summary.health.unknown}</span>, 
        <span class="summary-total">Total: ${data.summary.health.total}</span>
      </div>`;
    }
    resultPre.innerHTML = html;
  }

  async function postSelectedFile() {
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      alert('Please upload or capture an image first.');
      return;
    }
    const form = new FormData();
    form.append('image', file);

    setUploading(true);
    resultPre.textContent = '';

    try {
      const res = await fetch(`${API_BASE}/check-ingredients`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      renderScanResults(data);
    } catch (err) {
      resultPre.innerHTML = `<span style='color:red'>Error: ${err.message}</span>`;
    } finally {
      setUploading(false);
    }
  }

  // --- Upload flow ---
  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => fileInput?.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      showPreviewFromBlob(file);
    });
  }

  // --- Camera flow ---
  let stream = null;

  function stopStream() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
    } catch (err) {
      alert('Camera access denied or not available.\nTip: use http://localhost or https for camera API.');
      return null;
    }

    // Modal
    const modal = document.createElement('div');
    Object.assign(modal.style, {
      position: 'fixed',
      left: 0, top: 0, width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', zIndex: 9999,
    });

    const container = document.createElement('div');
    Object.assign(container.style, {
      background: '#fff', padding: '12px', borderRadius: '12px',
      maxWidth: '95%', maxHeight: '85%', display: 'flex',
      flexDirection: 'column', alignItems: 'center',
    });

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    Object.assign(video.style, { maxWidth: '600px', width: '100%' });
    video.srcObject = stream;

    const controls = document.createElement('div');
    Object.assign(controls.style, { marginTop: '8px', display: 'flex', gap: '8px' });

    const capture = document.createElement('button');
    capture.textContent = 'Capture';
    Object.assign(capture.style, { padding: '8px 12px' });

    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    Object.assign(cancel.style, { padding: '8px 12px' });

    controls.appendChild(capture);
    controls.appendChild(cancel);
    container.appendChild(video);
    container.appendChild(controls);
    modal.appendChild(container);
    document.body.appendChild(modal);

    // Capture handler
    capture.addEventListener('click', async () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/png');

      try {
        const blob = await dataUrlToBlob(dataUrl);
        // show preview
        showPreviewFromBlob(blob);
        // put into hidden file input so the same scan flow is used
        await blobToFileInput(blob, 'capture.png', 'image/png');
      } catch {
        alert('Could not prepare captured image for upload.');
      }

      stopStream();
      modal.remove();
    });

    // Cancel handler
    cancel.addEventListener('click', () => {
      stopStream();
      modal.remove();
    });

    return modal;
  }

  if (takeBtn) {
    takeBtn.addEventListener('click', async () => {
      await startCamera();
    });
  }

  // --- Scan button (multipart upload to Flask) ---
  if (scanBtn) {
    scanBtn.addEventListener('click', async () => {
      await postSelectedFile();
    });
  }

  // --- Prevent full page submit on the "Search Product" button ---
  if (formEl) {
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      // optional: you can trigger a product search here if you have that API
      // For now, just prevent reload.
    });
  }

  // --- Cleanup when navigating away ---
  window.addEventListener('beforeunload', stopStream);
});
