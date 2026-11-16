'use client'

import { useEffect } from 'react'

// Safari iOS no reduce el viewport de layout cuando aparece el teclado, así que
// la barra inferior fija quedaría tapando/pegada al teclado. Este componente
// marca <html data-keyboard="open"> mientras hay un campo de texto enfocado Y el
// visualViewport se ha encogido, y el CSS (globals.css) oculta la barra.
//
// Deliberadamente NO hace scroll por su cuenta: Safari ya desplaza el campo
// enfocado, y forzar scrollIntoView chocaba con los selectores nativos
// (mes/año del calendario) y descolocaba la pantalla.
export function ViewportSync() {
  useEffect(() => {
    const root = document.documentElement
    const vv = window.visualViewport
    if (!vv) return

    const isTextField = (el: Element | null) =>
      !!el && /^(INPUT|TEXTAREA)$/.test(el.tagName)

    const update = () => {
      const shrunk = window.innerHeight - vv.height > 120
      if (shrunk && isTextField(document.activeElement)) root.dataset.keyboard = 'open'
      else delete root.dataset.keyboard
    }

    update()
    vv.addEventListener('resize', update)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    return () => {
      vv.removeEventListener('resize', update)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
      delete root.dataset.keyboard
    }
  }, [])

  return null
}
