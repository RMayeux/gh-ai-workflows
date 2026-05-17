/**
 * Standardizes the rendering of AI-generated lists into GitHub Markdown.
 */
export function formatAIList(
  title: string, 
  items: string[], 
  itemPrefix: string = '- [ ] '
): string {
  if (!items || items.length === 0) return '';
  
  const list = items.map(item => `${itemPrefix}${item}`).join('\n');
  return `### ${title}\n${list}\n`;
}
