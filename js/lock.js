const CORRECT_HASH = 'd24eac45e69be063cc0053eb02650954eec62c314c405e564a4d11e951392e75';

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

document.getElementById('lock-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('lock-input');
  const error = document.getElementById('lock-error');
  const hash = await sha256(input.value.trim());
  if (hash === CORRECT_HASH) {
    localStorage.setItem('fm_unlocked', '1');
    document.documentElement.classList.remove('locked');
    error.hidden = true;
  } else {
    error.hidden = false;
    input.value = '';
    input.focus();
  }
});
