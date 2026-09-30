// Screen content is authored for a ~390px phone. --zs scales it with the
// shell's own canvas (the same min(100vw, 480px) the --u unit uses), plus a
// little extra because the content read small. Set once and on resize.

const BASE = 390
const BOOST = 1.1

export function installScale(): void {
  const set = () => {
    const w = Math.min(window.innerWidth || BASE, 480)
    document.documentElement.style.setProperty('--zs', String(Math.round((w / BASE) * BOOST * 100) / 100))
  }
  set()
  window.addEventListener('resize', set)
}
