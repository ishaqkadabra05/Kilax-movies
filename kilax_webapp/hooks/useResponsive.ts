import { useEffect, useState } from 'react'

export function useResponsive() {
  const [width, setWidth] = useState(
    typeof window === 'undefined' ? 1200 : window.innerWidth,
  )

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return {
    mobile: width < 700,
    tablet: width < 1024,
    width,
  }
}
