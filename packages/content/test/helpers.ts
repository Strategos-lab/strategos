import { CONTENT, HELD_OUT, sliceTexts, validateContent, type ContentBundle, type HeldOutBundle, type Issue } from '../src/index.ts';

export const clone = <T>(x: T): T => structuredClone(x);
export const sliceGated = () => sliceTexts().map((t) => ({ lesson: 'm3.l1', ...t }));
export function run(mut?: (b: ContentBundle, h: HeldOutBundle) => void): Issue[] {
  const b = clone(CONTENT);
  const h = clone(HELD_OUT);
  mut?.(b, h);
  return validateContent(b, { extraTexts: sliceGated(), heldOut: h });
}
export const rules = (issues: Issue[]) => [...new Set(issues.map((i) => i.rule))];
export const has = (issues: Issue[], rule: string, re: RegExp) => issues.some((i) => i.rule === rule && re.test(`${i.where} ${i.message}`));
export const item = (b: ContentBundle, id: string) => b.items.find((i) => i.id === id)!;
export const skin = (b: ContentBundle, id: string) => b.skins.find((i) => i.id === id)!;
