// Copyright 2022-present Jared Flatow
// SPDX-License-Identifier: GPL-3.0-only

import { JSONF, JSONFError } from '../mod.ts';

import { assert, assertEquals, assertThrows } from 'https://deno.land/std/testing/asserts.ts';

class Fable {
  json: any;

  static fromJSON(json: any): Fable {
    return new this(json);
  }

  constructor(json: any) {
    this.json = json;
  }

  method(...args: any[]): any[] {
    return args;
  }

  toJSON() {
    return this.json;
  }
}

class Fancy extends Fable {
  @JSONF.referrable
  static fun(arg: any): any {
    return arg;
  }

  @JSONF.referrable
  foo(): any {
    return this.json;
  }

  @JSONF.referBound
  bar(): any {
    return this.json;
  }
}

class Simple {
  data: any;

  constructor({ data }: any) {
    this.data = data;
  }
}

Deno.test("basic jsonf", async () => {
  assertEquals(JSONF.parse(JSONF.stringify(null)), null);

  const ar = [
    { name: "clx.js", isFile: true, isDirectory: false, isSymlink: false },
    { name: "clx.ts", isFile: true, isDirectory: false, isSymlink: false },
  ];
  assertEquals(JSONF.parse(JSONF.stringify(ar)), ar);

  const ob = { name: "clx.js", isFile: true, isDirectory: false, isSymlink: false };
  assertEquals(JSONF.parse(JSONF.stringify(ob)), ob);

  const a0 = JSONF.stringify({});
  const b0 = JSONF.parse(a0);
  assertEquals(a0, '{}');
  assertEquals(b0, {});

  const a1 = JSONF.stringify({ x: { $MAGIC$: { cls: 'Fable' } } });
  const b1 = JSONF.parse(a1, { Fable });
  assertEquals(b1, { x: Fable });
  assertThrows(() => JSONF.parse(a1), JSONFError, 'unknown class');

  const a2 = JSONF.stringify({ x: { $MAGIC$: { cls: 'Fable', ths: 'whatever' } } });
  const b2 = JSONF.parse(a2, { Fable });
  assertEquals(b2, { x: new Fable('whatever') });

  const a3 = JSONF.stringify({ x: { $MAGIC$: { cls: 'Fable', ths: 'whatever', key: 'method' } } });
  const b3 = JSONF.parse(a3, { Fable });
  assertEquals(b3.x(1, 2), [1, 2]);
});

Deno.test("transparent jsonf refs", async () => {
  const fn_ = Fancy.fun;
  const _f_ = JSONF.stringify(fn_);
  const _fn = JSONF.parse(_f_, { Fancy });
  assertEquals(fn_('z'), 'z');
  assertEquals(_fn('z'), 'z');
  assert(Fancy.fun === _fn);

  const fancy = new Fancy({ some: [true, 'bar'] });
  const _foo_ = JSONF.stringify(fancy.foo);
  const _food = JSONF.parse(_foo_, { Fancy });
  assertEquals(fancy.foo(), { some: [true, 'bar'] });
  assertEquals(fancy.foo(), _food());
  assert(fancy.foo !== _food);
});

Deno.test("bound methods", async () => {
  const fancy = new Fancy({ some: [false, 'foo'] });
  const _bar_ = JSONF.stringify(fancy.bar);
  const _bard = JSONF.parse(_bar_, { Fancy });
  assertEquals(fancy.bar(), { some: [false, 'foo'] });
  assertEquals(fancy.bar(), _bard());
  assert(fancy.bar !== _bard);
});

Deno.test("double parse", async () => {
  const a = JSONF.stringify(Fancy.fun);
  const b = JSONF.parse(a, { Fancy });
  const c = JSONF.stringify(b);
  const d = JSONF.parse(c, { Fancy });
  assertEquals(d, Fancy.fun);

  const x = new Fancy({ not: 'nil' });
  const e = JSONF.stringify(x.foo);
  const f = JSONF.parse(e, { Fancy });
  const g = JSONF.stringify(f);
  const h = JSONF.parse(g, { Fancy });
  assertEquals(h(), x.foo());
});

Deno.test("serializable classes and instances with overrides", async () => {
  const S = JSONF.stringify(Fable);
  const P = JSONF.parse(S, { Fable });
  assertEquals(P, Fable);

  const v = new Fable({ data: Fable });
  const s = JSONF.stringify(v);
  const p = JSONF.parse(s, { Fable });
  assertEquals(p, v);
});

Deno.test("serializable classes and instances without overrides", async () => {
  const S = JSONF.stringify(Simple);
  const P = JSONF.parse(S, { Simple });
  assertEquals(P, Simple);

  const v = new Simple({ data: Simple });
  const s = JSONF.stringify(v);
  const p = JSONF.parse(s, { Simple });
  assertEquals(p, v);
});

Deno.test("callables that return new classes", async () => {
  class H {
    static k = 'r';
    static extend(k: string) {
      return class extends this {
        static override k = k;
      }
    }
    static toJSON() {
      return { $MAGIC$: { cls: 'H', key: 'extend', args: [this.k] } };
    }
  }

  const J = H.extend('x');
  const S = JSONF.stringify(J);
  const P = JSONF.parse(S, { H });
  assertEquals(P.k, 'x');
});
