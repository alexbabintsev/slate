// Slate ships the same package to the Chrome Web Store and Edge Add-ons; the
// few things that differ (store links, toolbar wording) ask this.

type UAData = { brands?: Array<{ brand: string }> };

export function isEdge(nav: Pick<Navigator, 'userAgent'> & { userAgentData?: UAData } = globalThis.navigator): boolean {
  if (!nav) return false;
  if (nav.userAgentData?.brands?.some((b) => b.brand === 'Microsoft Edge')) return true;
  return /\bEdg\//.test(nav.userAgent ?? '');
}
