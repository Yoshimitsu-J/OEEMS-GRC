document.addEventListener('DOMContentLoaded', () => {
  const loginPanel = document.getElementById('loginPanel');
  const facilitatorPanel = document.getElementById('facilitatorPanel');
  const accessCode = document.getElementById('accessCode');
  const loginButton = document.getElementById('loginButton');
  const loginError = document.getElementById('loginError');
  const applicationIdInput = document.getElementById('applicationIdInput');
  const lookupButton = document.getElementById('lookupButton');
  const scanButton = document.getElementById('scanButton');
  const scannerPanel = document.getElementById('scannerPanel');
  const video = document.getElementById('video');
  const canvas = document.getElementById('qrCanvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const studentCard = document.getElementById('studentCard');
  const lookupError = document.getElementById('lookupError');
  let stream = null;
  let scanFrame = null;
  let currentApplicationId = '';

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: { ...(options.headers || {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Request failed.');
    return result;
  }

  async function checkSession() {
    try {
      const result = await api('/api/facilitator/me');
      loginPanel.hidden = true;
      facilitatorPanel.hidden = false;
      document.getElementById('facilitatorIdentity').textContent = `${result.facilitator.name} — ${result.facilitator.role}`;
    } catch {
      loginPanel.hidden = false;
      facilitatorPanel.hidden = true;
    }
  }

  loginButton.addEventListener('click', async () => {
    loginError.textContent = '';
    loginButton.disabled = true;
    try {
      const result = await api('/api/facilitator/login', { method: 'POST', body: JSON.stringify({ accessCode: accessCode.value }) });
      loginPanel.hidden = true;
      facilitatorPanel.hidden = false;
      document.getElementById('facilitatorIdentity').textContent = `${result.facilitator.name} — ${result.facilitator.role}`;
      accessCode.value = '';
    } catch (error) {
      loginError.textContent = error.message;
    } finally {
      loginButton.disabled = false;
    }
  });

  function applicationCodeFromQr(text) {
    try {
      const data = JSON.parse(text);
      return String(data.applicationCode || data.applicationId || data.applicantId || '').trim().toUpperCase();
    } catch {
      return text.trim().toUpperCase();
    }
  }

  async function lookup(applicationId) {
    lookupError.textContent = '';
    studentCard.style.display = 'none';
    currentApplicationId = '';
    try {
      const student = await api(`/api/facilitator/applicant/${encodeURIComponent(applicationId)}`);
      currentApplicationId = student.applicantId;
      document.getElementById('studentName').textContent = student.name;
      document.getElementById('studentApplicantId').textContent = student.applicantId;
      document.getElementById('studentApplicationId').textContent = student.applicationId;
      document.getElementById('studentApprovalStatus').textContent = student.approvalStatus.toUpperCase();
      document.getElementById('studentExamDate').textContent = student.examDate ? new Date(student.examDate).toLocaleDateString('en-PH') : 'Not scheduled';
      document.getElementById('studentExamTime').textContent = student.examBatch && student.examTime ? `${student.examBatch.replace(/^batch_/, 'Batch ')} — ${student.examTime}` : 'Not configured';
      document.getElementById('studentMobile').textContent = student.mobileNumber;
      document.getElementById('studentEmail').textContent = student.email || 'Not provided';
      studentCard.style.display = 'block';
      stopScanner();
    } catch (error) {
      lookupError.textContent = error.message;
    }
  }

  lookupButton.addEventListener('click', () => {
    const applicationId = applicationIdInput.value.trim();
    if (applicationId) lookup(applicationId);
  });
  applicationIdInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') lookupButton.click();
  });

  function stopScanner() {
    if (scanFrame) cancelAnimationFrame(scanFrame);
    scanFrame = null;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    stream = null;
    scannerPanel.style.display = 'none';
    scanButton.textContent = 'SCAN QR CODE';
  }

  async function scanFrameLoop() {
    if (!stream || video.readyState !== video.HAVE_ENOUGH_DATA) {
      scanFrame = requestAnimationFrame(scanFrameLoop);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = window.jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
    if (code?.data) {
      applicationIdInput.value = applicationCodeFromQr(code.data);
      await lookup(applicationIdInput.value);
      return;
    }
    scanFrame = requestAnimationFrame(scanFrameLoop);
  }

  scanButton.addEventListener('click', async () => {
    if (stream) return stopScanner();
    lookupError.textContent = '';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      video.srcObject = stream;
      await video.play();
      scannerPanel.style.display = 'block';
      scanButton.textContent = 'STOP SCANNER';
      scanFrame = requestAnimationFrame(scanFrameLoop);
    } catch (error) {
      lookupError.textContent = 'Camera access is unavailable. Enter the Application ID manually.';
    }
  });

  document.getElementById('closeStudentButton').addEventListener('click', () => {
    studentCard.style.display = 'none';
    applicationIdInput.value = '';
    currentApplicationId = '';
  });
  document.getElementById('confirmArrivalButton').addEventListener('click', async () => {
    if (!currentApplicationId) return;
    try {
      await api('/api/facilitator/arrived', { method: 'POST', body: JSON.stringify({ applicantId: currentApplicationId }) });
      lookupError.style.color = '#168a45';
      lookupError.textContent = 'Applicant arrival confirmed.';
      studentCard.style.display = 'none';
      applicationIdInput.value = '';
      currentApplicationId = '';
    } catch (error) {
      lookupError.style.color = '#a00000';
      lookupError.textContent = error.message;
    }
  });

  checkSession();
});
