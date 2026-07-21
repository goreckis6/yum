// Tiny shared flag for "the user opened a password-reset link". It lives
// outside React so the top-level deep-link handler in App.tsx (which is mounted
// above the AuthProvider) can set it, and AuthContext can mirror it into state
// to drive the "set a new password" screen.
type Listener = (v: boolean) => void;

let value = false;
const listeners = new Set<Listener>();

export function setRecovering(v: boolean) {
  value = v;
  listeners.forEach((l) => l(v));
}

export function getRecovering() {
  return value;
}

export function subscribeRecovering(l: Listener) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
