/**
 * Hashes a File object locally using the Web Crypto API.
 * The file NEVER leaves the browser — only the hex digest is transmitted.
 */
export async function hashFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer  = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return bufferToHex(hashBuffer);
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
