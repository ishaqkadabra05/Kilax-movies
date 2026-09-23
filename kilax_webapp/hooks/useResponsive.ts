import { useEffect, useState } from 'react'

export function useResponsive() {
  // Always start with the SSR-safe default so the server and the first
  // client render produce identical HTML (no hydration mismatch).
  // The real window width is read in useEffect, which only runs on the
  // client after hydration is complete.
  const [width, setWidth] = useState(1200)

  useEffect(() => {
    // Sync to actual viewport immediately after mount, then track resizes.
    const update = () => setWidth(window.innerWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return {
    mobile: width < 700,
    tablet: width < 1024,
    width,
  }
}
