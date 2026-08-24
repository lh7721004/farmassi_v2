import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../../lib/auth'
import { isProfilePending, profileNeedsCompletion } from '../../lib/profileCompletion'
import { ProfileCompletionSheet } from './ProfileCompletionSheet'

export function ProfileCompletionProvider({ children }: { children: ReactNode }) {
  const { loading, user, profile } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user || !profile) {
      setOpen(false)
      return
    }
    setOpen(isProfilePending() || profileNeedsCompletion(profile))
  }, [loading, user, profile])

  return (
    <>
      {children}
      <ProfileCompletionSheet open={open} onCompleted={() => setOpen(false)} />
    </>
  )
}
