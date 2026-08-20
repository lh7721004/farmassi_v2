import type { DepositProvider, DepositProviderId } from './types'
import { banksaladDepositProvider } from './providers/banksalad'
import { bankdaDepositProvider } from './providers/bankda'
import { codefDepositProvider } from './providers/codef'
import { gndDepositProvider } from './providers/gnd'
import { hectoDepositProvider } from './providers/hecto'
import { manualDepositProvider } from './providers/manual'

const providers: Record<DepositProviderId, DepositProvider> = {
  manual: manualDepositProvider,
  gnd: gndDepositProvider,
  hecto: hectoDepositProvider,
  banksalad: banksaladDepositProvider,
  codef: codefDepositProvider,
  bankda: bankdaDepositProvider,
}

export function getDepositProvider(id: DepositProviderId = 'manual'): DepositProvider {
  return providers[id]
}

export const DEPOSIT_PROVIDER_ENV = {
  GND_API_KEY: 'GND_API_KEY',
  HECTO_API_KEY: 'HECTO_API_KEY',
  BANKSALAD_API_KEY: 'BANKSALAD_API_KEY',
  CODEF_CLIENT_ID: 'CODEF_CLIENT_ID',
  CODEF_CLIENT_SECRET: 'CODEF_CLIENT_SECRET',
  BANKDA_ACCESS_TOKEN: 'BANKDA_ACCESS_TOKEN',
} as const
