'use client'

import { useEffect } from 'react'

// Safari iOS no reduce el viewport de layout cuando aparece el teclado (dvh no
// cambia). Este componente mide el visualViewport y expone:
//   --vv-height        alto visible real (px)
//   <html data-keyboard="open"> cuando el teclado está abierto
// y desplaza el input enfocado a la zona visible. No renderiza nada.
export function ViewportSync() {
  useEffect(() => {
    const root = document.documentElement
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      root.style.setProperty('--vv-height', `${vv.height}px`)
      const keyboardOpen = window.innerHeight - vv.height > 120
      if (keyboardOpen) root.dataset.keyboard = 'open'
      else delete root.dataset.keyboard
    }

    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null
      if (!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      // Espera a que el teclado termine de animarse
      window.setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 320)
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      document.removeEventListener('focusin', onFocusIn)
      delete root.dataset.keyboard
    }
  }, [])

  return null
}
