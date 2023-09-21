// Copyright 2022-present Jared Flatow
// SPDX-License-Identifier: GPL-3.0-only

export class JSONFError extends Error {
  context: object;

  constructor(message: string, context = {}) {
    super(`${message}: ${JSON.stringify(context)}`);
    this.name = this.constructor.name;
    this.context = context;
  }
}

export interface JSONFable<T, U> { fromJSON?(o: T): U }
export interface JSONFables { [k: string]: JSONFable<any, any> | any };

export function referrable(target: any, key: PropertyKey, val: any, bind = false) {
  if (target.name) {
    // decorating static prop
    const cls = target.name;
    return Object.assign(val, { $MAGIC$: { cls, key } });
  } else {
    // decorating instance prop
    const cls = target.constructor.name;
    return {
      get() {
        if (bind)
          return Object.assign(val.bind(this), { $MAGIC$: { cls, ths: this, key } });
        return Object.assign(val, { $MAGIC$: { cls, ths: this, key } });
      }
    }
  }
}

export class JSONF {
  // if we don't need equality checks, and we do want bound
  static referBound(target: any, key: PropertyKey) {
    return referrable(target, key, Reflect.get(target, key), true);
  }

  // if we need equality checks, and can do without bound
  static referrable(target: any, key: PropertyKey) {
    return referrable(target, key, Reflect.get(target, key));
  }

  static stringify(thing: any): string {
    function replacer(k: string | null, v: any): any {
      if (v) {
        if (v.$MAGIC$) {
          return { $MAGIC$: v.$MAGIC$ };
        } else if (typeof(v) === 'function') {
          return { $MAGIC$: { cls: v.name } };
        } else if (typeof(v) === 'object' && v.constructor && !['Array', 'Object'].includes(v.constructor.name)) {
          const ths = v.toJSON ? v.toJSON() : { ...v };
          return { $MAGIC$: { cls: v.constructor.name, ths } };
        }
      }
      return v;
    }
    return JSON.stringify(replacer(null, thing), replacer);
  }

  static parse(str: string, clses: JSONFables = {}): any {
    function reviver(k: string, v: any): any {
      const magic = v && v.$MAGIC$;
      if (magic) {
        const cls = clses[magic.cls];
        if (!cls)
          throw new JSONFError('unknown class', magic);
        if (magic.ths) {
          const o = cls.fromJSON ? cls.fromJSON(magic.ths) : new cls(magic.ths);
          if (magic.key) {
            const p = o[magic.key];
            const v = typeof(p) == 'function' ? p.bind(o) : p;
            return Object.assign(v, { $MAGIC$: magic });
          } else {
            return o;
          }
        } else {
          if (magic.key) {
            const p = (cls as any)[magic.key];
            return p;
          } else {
            return cls;
          }
        }
      }
      return v;
    }
    return JSON.parse(str, reviver);
  }
}
