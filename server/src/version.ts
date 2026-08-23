import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 서버 버전.
 *
 * package.json 의 버전과 지금 돌고 있는 커밋을 함께 낸다. 배포 후 "고친 게
 * 반영됐나" 를 화면에서 바로 확인할 수 있어야 하기 때문이다.
 * 기동 시 한 번만 읽는다 — 돌아가는 동안 바뀌지 않는 값이다.
 */

const here = dirname(fileURLToPath(import.meta.url))

function packageVersion(): string {
  try {
    return JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')).version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function commitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: here, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

export const VERSION = {
  version: packageVersion(),
  commit: commitHash(),
  startedAt: new Date().toISOString(),
} as const
