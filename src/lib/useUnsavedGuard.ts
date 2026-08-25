import { useEffect } from 'react'

/**
 * 저장하지 않은 값이 있을 때 페이지를 떠나려 하면 물어본다.
 *
 * 세 가지 경로를 모두 막아야 한다.
 *   새로고침·창닫기   beforeunload (브라우저 기본 경고)
 *   브라우저 뒤로가기  popstate — 화면 안에서 주소만 바뀌어 beforeunload 가 안 뜬다
 *   화면 안 이동      사이드바 NavLink, 헤더 뒤로가기 버튼
 *
 * 화면 안 이동은 클릭을 캡처 단계에서 가로챈다. react-router 의 useBlocker 는
 * 데이터 라우터에서만 쓸 수 있는데 이 앱은 BrowserRouter 라 쓸 수 없다.
 */
const MESSAGE = '저장하지 않은 데이터가 있습니다. 페이지에서 나가시겠습니까?'

export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return

    const warnUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warnUnload)

    // 뒤로가기: 히스토리에 한 칸을 더 넣어 두고, 뒤로 오면 물어본다.
    history.pushState(null, '', location.href)
    const onPop = () => {
      if (window.confirm(MESSAGE)) {
        window.removeEventListener('popstate', onPop)
        history.back()
        return
      }
      history.pushState(null, '', location.href)
    }
    window.addEventListener('popstate', onPop)

    /**
     * 화면 안 이동을 가로챈다.
     *
     * 캡처 단계에서 잡아야 react-router 가 먼저 처리해 버리지 않는다.
     * 링크(<a>)와, 뒤로가기처럼 navigate 를 부르는 버튼(data-nav)을 본다.
     * 새 탭·다운로드·외부 주소는 건드리지 않는다 — 페이지를 떠나지 않는다.
     */
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const el = target?.closest('a[href], [data-leave-guard]') as HTMLElement | null
      if (!el) return

      if (el.tagName === 'A') {
        const a = el as HTMLAnchorElement
        if (a.target === '_blank' || a.hasAttribute('download')) return
        if (a.origin !== location.origin) return
        if (a.pathname === location.pathname) return   // 같은 화면이면 잃을 게 없다
      }
      if (window.confirm(MESSAGE)) return
      e.preventDefault()
      e.stopPropagation()
    }
    document.addEventListener('click', onClick, true)

    return () => {
      window.removeEventListener('beforeunload', warnUnload)
      window.removeEventListener('popstate', onPop)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty])
}
