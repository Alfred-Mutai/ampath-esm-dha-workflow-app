import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp } from '@carbon/react/icons';
import styles from './scroll-to-top.component.scss';

// Nearest scrollable ancestor of a node, or null to fall back to the window.
const getScrollParent = (node: HTMLElement | null): HTMLElement | null => {
  let el = node?.parentElement ?? null;
  while (el) {
    const overflowY = getComputedStyle(el).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
};

/**
 * A floating "back to top" button, shown once the page (or its scroll container) is
 * scrolled past `threshold`. Handy on long details pages.
 */
const ScrollToTop: React.FC<{ threshold?: number }> = ({ threshold = 400 }) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement | Window>(window);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const scroller: HTMLElement | Window = getScrollParent(anchorRef.current) ?? window;
    scrollerRef.current = scroller;
    const currentTop = () => (scroller instanceof Window ? scroller.scrollY : scroller.scrollTop);
    const onScroll = () => setVisible(currentTop() > threshold);
    scroller.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [threshold]);

  const handleClick = () => {
    scrollerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div ref={anchorRef} aria-hidden="true" />
      {visible ? (
        <button type="button" className={styles.scrollTop} onClick={handleClick} aria-label="Scroll to top" title="Scroll to top">
          <ArrowUp size={20} className={styles.icon} />
          <span className={styles.label}>Scroll to top</span>
        </button>
      ) : null}
    </>
  );
};

export default ScrollToTop;
