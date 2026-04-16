import { createContext, useContext } from 'react'

export const ReadOnlyContext = createContext<boolean>(false)

/** Returns true when the current view is a shared read-only portfolio. */
export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext)
}
