'use client';

import { useEffect } from 'react';

/** Below this scroll position the header always shows (the page top, the navy banner). */
const TOP = 120;
/** Ignore tiny scroll jitters. */
const STEP = 6;

/**
 * Phones only: scrolling down slides the sticky header away so the page gets the screen; scrolling up brings it back.
 * It sets `data-header-hidden` on <html>; SiteHeader and the PageHeader tab bar read it in CSS. Focus inside the header shows it.
 */
export function HeaderAutoHide() {
  useEffect(() => {
    const root = document.documentElement;
    const phone = window.matchMedia('(max-width: 640px)');
    let last = window.scrollY;
    let queued = false;
    const show = () => root.removeAttribute('data-header-hidden');
    const update = () => {
      queued = false;
      const y = window.scrollY;
      if (!phone.matches || y < TOP) { show(); last = y; return; }
      if (y - last > STEP) { root.setAttribute('data-header-hidden', ''); last = y; }
      else if (last - y > STEP) { show(); last = y; }
    };
    const onScroll = () => { if (!queued) { queued = true; window.requestAnimationFrame(update); } };
    const onFocus = (e: FocusEvent) => { if (e.target instanceof Element && e.target.closest('header')) show(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    phone.addEventListener('change', update);
    document.addEventListener('focusin', onFocus);
    return () => {
      window.removeEventListener('scroll', onScroll);
      phone.removeEventListener('change', update);
      document.removeEventListener('focusin', onFocus);
      show();
    };
  }, []);
  return null;
}
