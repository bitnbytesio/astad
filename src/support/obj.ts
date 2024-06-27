/**
 * just to support Node.js 16
 * @param obj 
 * @returns 
 */
export function deepClone(obj: any) {
  if (typeof structuredClone == 'function') {
    return structuredClone(obj);
  }

  return JSON.parse(JSON.stringify(obj));
}