import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 同步复制（须落在用户手势里，例如 pointerdown），避免 Drawer 等与异步 Clipboard 抢焦点导致 execCommand 复制到页面上无关选区 */
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
    // 勿用 readonly：部分 Chromium 会跳过选中复制；移出可视区，避免 Radix FocusScope 抢到错误选区
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

/** 在 pointerdown 等同步手势里调用，优先保证剪贴板内容正确（再配 onClick 里的异步 API 兜底） */
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
