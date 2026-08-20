/**
 * Deposit confirmation provider interface.
 * v1 uses `manual`. `bankda` is polled server-side by the scrape-deposits function.
 * GND / Hecto / BankSalad / CodeF implement poll() later
 * and call the same confirm-deposit entrypoint.
 */

export type DepositProviderId = 'manual' | 'gnd' | 'hecto' | 'banksalad' | 'codef' | 'bankda'

export interface PolledDeposit {
  occurredAt: string
  amount: number
  depositorName?: string
  rawPayload: Record<string, unknown>
}

export interface DepositProvider {
  id: DepositProviderId
  poll(): Promise<PolledDeposit[]>
}

export class NotImplementedError extends Error {
  constructor(provider: string) {
    super(`${provider} 연동은 아직 구현되지 않았습니다.`)
    this.name = 'NotImplementedError'
  }
}
