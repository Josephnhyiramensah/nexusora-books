import { useState, useEffect } from 'react';

const BREAKPOINTS = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
};

export function useBreakpoint() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handle = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  return {
    width,
    isMobile:  width < 768,
    isTablet:  width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    isSmall:   width < 480,
    // Helpers
    below: (bp) => width < BREAKPOINTS[bp],
    above: (bp) => width >= BREAKPOINTS[bp],
  };
}