import { Env } from '../dist/index.js';

describe('CEL Typechecking', () => {
  describe('Basic type inference', () => {
    test('should typecheck simple integer expression', async () => {
      const env = await Env.new();
      const result = await env.typecheck('10 + 20');
      expect(result.type).toBe('int');
    });

    test('should typecheck simple string expression', async () => {
      const env = await Env.new();
      const result = await env.typecheck('"hello" + "world"');
      expect(result.type).toBe('string');
    });

    test('should typecheck boolean expression', async () => {
      const env = await Env.new();
      const result = await env.typecheck('true && false');
      expect(result.type).toBe('bool');
    });
  });

  describe('Typechecking with variables', () => {
    test('should typecheck expression with integer variables', async () => {
      const env = await Env.new({
        variables: [
          { name: 'x', type: 'int' },
          { name: 'y', type: 'int' }
        ]
      });
      const result = await env.typecheck('x + y');
      expect(result.type).toBe('int');
    });

    test('should typecheck expression with double variables', async () => {
      const env = await Env.new({
        variables: [
          { name: 'x', type: 'double' },
          { name: 'y', type: 'double' }
        ]
      });
      const result = await env.typecheck('x + y');
      expect(result.type).toBe('double');
    });

    test('should typecheck string concatenation with variables', async () => {
      const env = await Env.new({
        variables: [
          { name: 'name', type: 'string' },
          { name: 'age', type: 'int' }
        ]
      });
      const result = await env.typecheck('name + string(age)');
      expect(result.type).toBe('string');
    });
  });

  describe('List type inference', () => {
    test('should typecheck list literal', async () => {
      const env = await Env.new();
      const result = await env.typecheck('[1, 2, 3]');
      expect(result.type).toEqual({
        kind: 'list',
        elementType: 'int'
      });
    });

    test('should typecheck list with string elements', async () => {
      const env = await Env.new();
      const result = await env.typecheck('["a", "b", "c"]');
      expect(result.type).toEqual({
        kind: 'list',
        elementType: 'string'
      });
    });

    test('should typecheck list variable access', async () => {
      const env = await Env.new({
        variables: [
          { name: 'myList', type: { kind: 'list', elementType: 'int' } }
        ]
      });
      const result = await env.typecheck('myList[0]');
      expect(result.type).toBe('int');
    });
  });

  describe('Map type inference', () => {
    test('should typecheck map literal', async () => {
      const env = await Env.new();
      const result = await env.typecheck('{"key": "value"}');
      expect(result.type).toEqual({
        kind: 'map',
        keyType: 'string',
        valueType: 'string'
      });
    });

    test('should typecheck map access', async () => {
      const env = await Env.new({
        variables: [
          { name: 'myMap', type: { kind: 'map', keyType: 'string', valueType: 'int' } }
        ]
      });
      const result = await env.typecheck('myMap["key"]');
      expect(result.type).toBe('int');
    });
  });

  describe('Comparison expressions', () => {
    test('should typecheck comparison expression', async () => {
      const env = await Env.new({
        variables: [
          { name: 'x', type: 'int' },
          { name: 'y', type: 'int' }
        ]
      });
      const result = await env.typecheck('x > y');
      expect(result.type).toBe('bool');
    });

    test('should typecheck equality comparison', async () => {
      const env = await Env.new({
        variables: [
          { name: 'x', type: 'string' },
          { name: 'y', type: 'string' }
        ]
      });
      const result = await env.typecheck('x == y');
      expect(result.type).toBe('bool');
    });
  });

  describe('Ternary expressions', () => {
    test('should typecheck ternary expression', async () => {
      const env = await Env.new({
        variables: [
          { name: 'x', type: 'int' },
          { name: 'y', type: 'int' }
        ]
      });
      const result = await env.typecheck('x > y ? "greater" : "lesser"');
      expect(result.type).toBe('string');
    });
  });

  describe('Error handling', () => {
    test('should throw error for invalid syntax', async () => {
      const env = await Env.new();
      await expect(env.typecheck('invalid syntax !!!')).rejects.toThrow();
    });

    test('should throw error for type mismatch', async () => {
      const env = await Env.new({
        variables: [
          { name: 'x', type: 'int' },
          { name: 'y', type: 'string' }
        ]
      });
      await expect(env.typecheck('x + y')).rejects.toThrow();
    });

    test('should throw error for undeclared variables', async () => {
      const env = await Env.new({
        variables: [
          { name: 'x', type: 'int' }
        ]
      });
      await expect(env.typecheck('x + y')).rejects.toThrow();
    });
  });
});
