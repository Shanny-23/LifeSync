import gsap from 'gsap';
import { Flip } from 'gsap/Flip';

// Register Flip plugin
gsap.registerPlugin(Flip);

/**
 * Checks if the user has requested reduced motion at OS level.
 */
export const prefersReducedMotion = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Animate a tactile button press (scale down then up).
 */
export const animateTap = (element) => {
  if (!element || prefersReducedMotion()) return;
  gsap.fromTo(
    element,
    { scale: 0.92 },
    { scale: 1, duration: 0.12, ease: 'power1.out', overwrite: 'auto' }
  );
};

/**
 * Animate modal entrance (scale 0.95 -> 1, opacity 0 -> 1).
 */
export const animateModalEnter = (backdropEl, modalEl, onComplete) => {
  if (prefersReducedMotion()) {
    if (backdropEl) backdropEl.style.opacity = '1';
    if (modalEl) {
      modalEl.style.opacity = '1';
      modalEl.style.transform = 'none';
    }
    if (onComplete) onComplete();
    return;
  }

  const tl = gsap.timeline({ onComplete });

  if (backdropEl) {
    tl.fromTo(
      backdropEl,
      { opacity: 0 },
      { opacity: 1, duration: 0.2, ease: 'power2.out' },
      0
    );
  }

  if (modalEl) {
    tl.fromTo(
      modalEl,
      { opacity: 0, scale: 0.95, y: 10 },
      { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: 'power2.out' },
      0
    );
  }
};

/**
 * Animate modal exit before unmounting.
 */
export const animateModalExit = (backdropEl, modalEl, onComplete) => {
  if (prefersReducedMotion()) {
    if (onComplete) onComplete();
    return;
  }

  const tl = gsap.timeline({ onComplete });

  if (modalEl) {
    tl.to(
      modalEl,
      { opacity: 0, scale: 0.95, y: 8, duration: 0.15, ease: 'power2.in' },
      0
    );
  }

  if (backdropEl) {
    tl.to(
      backdropEl,
      { opacity: 0, duration: 0.15, ease: 'power2.in' },
      0
    );
  }
};

export { gsap, Flip };
export default gsap;
