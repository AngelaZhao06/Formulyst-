// Upload & camera functionality for scan-ingredient page
const uploadBtn = document.getElementById('upload-picture');
const takeBtn = document.getElementById('take-picture');
const fileInput = document.getElementById('file-input');
const preview = document.getElementById('preview');
const previewImg = document.getElementById('preview-img');

// Upload flow: forward to hidden file input
uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    previewImg.src = url;
    preview.style.display = 'block';
});

// Camera flow: open modal with live video, capture then show preview
let stream = null;

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch (err) {
        alert('Camera access denied or not available.');
        return null;
    }

    // create modal elements
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.left = 0;
    modal.style.top = 0;
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.background = 'rgba(0,0,0,0.6)';
    modal.style.zIndex = 9999;

    const container = document.createElement('div');
    container.style.background = '#fff';
    container.style.padding = '12px';
    container.style.borderRadius = '12px';
    container.style.maxWidth = '95%';
    container.style.maxHeight = '85%';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.style.maxWidth = '600px';
    video.style.width = '100%';
    video.srcObject = stream;

    const controls = document.createElement('div');
    controls.style.marginTop = '8px';
    controls.style.display = 'flex';
    controls.style.gap = '8px';

    const capture = document.createElement('button');
    capture.textContent = 'Capture';
    capture.style.padding = '8px 12px';

    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.style.padding = '8px 12px';

    controls.appendChild(capture);
    controls.appendChild(cancel);
    container.appendChild(video);
    container.appendChild(controls);
    modal.appendChild(container);
    document.body.appendChild(modal);

    // capture handler
    capture.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        previewImg.src = dataUrl;
        preview.style.display = 'block';
        stopStream();
        modal.remove();
    });

    cancel.addEventListener('click', () => {
        stopStream();
        modal.remove();
    });

    return modal;
}

function stopStream() {
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }
}

takeBtn.addEventListener('click', async () => {
    await startCamera();
});

// cleanup when navigating away
window.addEventListener('beforeunload', stopStream);
