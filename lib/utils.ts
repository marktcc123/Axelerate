import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Sync copy inside a real user gesture (e.g. pointerdown); avoids Drawer/async Clipboard stealing focus so execCommand copies stray page selection */
function legacyCopyViaTextarea(text: string): boolean {
  try {
    if (typeof document === 'undefined') return false

    try {
      window.getSelection()?.removeAllRanges()
    } catch {
      //
    }

    const ta = document.createElement('textarea')
    ta.value = text
    ta.readOnly = false
    // Avoid readonly: some Chromium builds skip selectable copy; off-screen avoids Radix FocusScope grabbing wrong range
    ta.style.cssText =
      'position:fixed;top:0;left:-9999px;width:320px;height:1px;margin:0;padding:0;border:0;opacity:0;pointer-events:none'
    ta.setAttribute('aria-hidden', 'true')
    ta.setAttribute('tabindex', '-1')
    document.body.appendChild(ta)
    ta.focus({ preventScroll: true })
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)

    try {
      window.getSelection()?.removeAllRanges()
    } catch {
      //
    }

    return !!ok
  } catch {
    return false
  }
}

/** Call on pointerdown (sync gesture); prefer correct clipboard payload, pairing with async API fallback in onClick */
export function copyTextToClipboardSync(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return legacyCopyViaTextarea(t)
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  const t = text.trim()
  if (!t) return false

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t)
      return true
    }
  } catch {
    //
  }

  try {
    if (
      typeof navigator !== 'undefined' &&
      typeof ClipboardItem !== 'undefined' &&
      navigator.clipboard?.write
    ) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([t], { type: 'text/plain' }),
        }),
      ])
      return true
    }
  } catch {
    //
  }

  return legacyCopyViaTextarea(t)
}
