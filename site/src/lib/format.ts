export function humanize(value: string): string {
  const words = value.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function humanizeList(values: string[]): string {
  return values.map(humanize).join(', ');
}
