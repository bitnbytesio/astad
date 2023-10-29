export function isFunction(value: any) {
  const type = typeof value;
  if (type !== 'function' && type !== 'object') {
    return false;
  }

  const tag = Object.prototype.toString.call(value);
  return tag == '[object Function]' || tag == '[object AsyncFunction]';
}

export function isClass(obj: any) {
  const isCtorClass = obj.constructor
    && obj.constructor.toString().substring(0, 5) === 'class'
  if (obj.prototype === undefined) {
    return isCtorClass
  }
  const isPrototypeCtorClass = obj.prototype.constructor
    && obj.prototype.constructor.toString
    && obj.prototype.constructor.toString().substring(0, 5) === 'class'
  return isCtorClass || isPrototypeCtorClass
}

export function isPrimitiveParamType(paramTypeName: string): boolean {
  return ['string', 'boolean', 'number', 'object'].includes(paramTypeName.toLowerCase());
}