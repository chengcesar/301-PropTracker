/** One-shot channel for "open this property, then land on tab X" navigation (e.g. a portfolio-wide table row linking straight to a property's CapEx tab). */
let pendingTab: string | null = null

export function setPendingPropertyTab(tab: string): void {
  pendingTab = tab
}

export function consumePendingPropertyTab(): string | null {
  const tab = pendingTab
  pendingTab = null
  return tab
}
