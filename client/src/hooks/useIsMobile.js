// client/src/hooks/useIsMobile.js
// Tiny reusable hook: true when the viewport is narrow (mobile). Used to switch
// wide financial tables into stacked cards on small screens.
import { useState, useEffect } from 'react';

export default function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return isMobile;
}