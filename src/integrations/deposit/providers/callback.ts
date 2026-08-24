import type { DepositProvider } from '../types'

export const callbackDepositProvider: DepositProvider = {
  id: 'callback',
  async poll() {
    return []
  },
}
