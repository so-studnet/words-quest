/** Link to Google Images for a query (opened in a new tab; nothing is sent from this site). */
export function googleImagesUrl(query: string): string {
  const p = new URLSearchParams({ q: query, tbm: "isch", udm: "2" }); // tbm=isch (classic) and udm=2 (current) both mean "Images"
  return `https://www.google.com/search?${p.toString()}`;
}
