import type { Db } from '../db.ts'

export interface FnCtx {
  userId: string | null
  body: any
  /** RLS 를 우회하는 커넥션. Edge Function 이 service_role 로 돌던 것과 같다. */
  admin: Db
}

export interface FnResult { status: number; body: unknown }

export const ok = (body: unknown = { ok: true }): FnResult => ({ status: 200, body })
export const fail = (message: string, status = 400): FnResult => ({ status, body: { error: message } })

export type FnHandler = (ctx: FnCtx) => Promise<FnResult>
