import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 同步复制（保留点击手势），不依赖异步 Clipboard API — 专治 writeText resolve 但实际未写入 */
function legacyCopyViaTextarea(text: string): boolean {
  try {
    if (typeof document === 'undefined') return false
    const ta = document.createElement('textarea')
    ta.value = text
    // 勿用 readonly：部分 Chromium 会跳过选中复制
    ta.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:1px;margin:0;padding:0;border:0;opacity:0'
    ta.setAttribute('aria-hidden', 'true')
    ta.setAttribute('tabindex', '-1')
    document.body.appendChild(ta)
    ta.focus({ preventScroll: true })
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return !!ok
  } catch {
    return false
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  const t = text.trim()
  if (!t) return false

  if (legacyCopyViaTextarea(t)) return true

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t)
    }
  } catch {
    //
  }

  if (legacyCopyViaTextarea(t)) return true

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
    }
  } catch {
    //
  }

  return legacyCopyViaTextarea(t)
}
