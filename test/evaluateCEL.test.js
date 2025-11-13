import { evaluateCEL } from '../dist/index.js';

describe('evaluateCEL', () => {
  describe('Basic arithmetic', () => {
    test('should evaluate simple addition', async () => {
      const result = await evaluateCEL('10 + 20');
      expect(result.result).toBe(30);
    });

    test('should handle operator precedence', async () => {
      const result = await evaluateCEL('10 + 20 * 2');
      expect(result.result).toBe(50);
    });
  });

  describe('Expressions with variables', () => {
    test('should evaluate expression with variables', async () => {
      const result = await evaluateCEL('x + y', { x: 10, y: 20 });
      expect(result.result).toBe(30);
    });

    test('should handle missing variables and throw error', async () => {
      await expect(evaluateCEL('x + y')).rejects.toThrow();
    });
  });

  describe('String operations', () => {
    test('should concatenate strings with variables', async () => {
      const result = await evaluateCEL(
        'name + " is " + string(age) + " years old"',
        {
          name: 'Alice',
          age: 30,
        },
      );
      expect(result.result).toBe('Alice is 30 years old');
    });
  });

  describe('Comparison expressions', () => {
    test('should evaluate greater than comparison', async () => {
      const result = await evaluateCEL('x > y', { x: 10, y: 5 });
      expect(result.result).toBe(true);
    });

    test('should evaluate less than comparison', async () => {
      const result = await evaluateCEL('x < y', { x: 5, y: 10 });
      expect(result.result).toBe(true);
    });

    test('should evaluate equality comparison', async () => {
      const result = await evaluateCEL('x == y', { x: 10, y: 10 });
      expect(result.result).toBe(true);
    });
  });

  describe('Ternary expressions', () => {
    test('should return first branch when condition is true', async () => {
      const result = await evaluateCEL('x > y ? "greater" : "lesser"', {
        x: 10,
        y: 5,
      });
      expect(result.result).toBe('greater');
    });

    test('should return second branch when condition is false', async () => {
      const result = await evaluateCEL('x > y ? "greater" : "lesser"', {
        x: 5,
        y: 10,
      });
      expect(result.result).toBe('lesser');
    });
  });

  describe('List operations', () => {
    test('should get list size', async () => {
      const result = await evaluateCEL('myList.size()', {
        myList: [1, 2, 3, 4, 5],
      });
      expect(result.result).toBe(5);
    });

    test('should check if list is empty', async () => {
      const result = await evaluateCEL('myList.size() > 0', {
        myList: [1, 2, 3],
      });
      expect(result.result).toBe(true);
    });
  });

  describe('Map operations', () => {
    test('should access map values by key', async () => {
      const result = await evaluateCEL('myMap["key"]', {
        myMap: { key: 'value' },
      });
      expect(result.result).toBe('value');
    });

    test('should handle nested map access', async () => {
      const result = await evaluateCEL(
        'user["name"] + " has " + string(user["score"]) + " points"',
        {
          user: { name: 'Bob', score: 100 },
        },
      );
      expect(result.result).toBe('Bob has 100 points');
    });
  });

  describe('Boolean logic', () => {
    test('should evaluate AND expressions', async () => {
      const result = await evaluateCEL('x > 0.0 && y > 0.0', {
        x: 5,
        y: 10,
      });
      expect(result.result).toBe(true);
    });

    test('should evaluate OR expressions', async () => {
      const result = await evaluateCEL('x > 0.0 || y > 0.0', {
        x: -5,
        y: 10,
      });
      expect(result.result).toBe(true);
    });

    test('should evaluate complex boolean expressions', async () => {
      const result = await evaluateCEL('(x > 0.0 && y > 0.0) || z > 100.0', {
        x: 5,
        y: 10,
        z: 50,
      });
      expect(result.result).toBe(true);
    });
  });

  describe('Error handling', () => {
    test('should throw error for invalid expressions', async () => {
      await expect(evaluateCEL('invalid syntax !!!')).rejects.toThrow();
    });

    test('should throw error when required variables are missing', async () => {
      await expect(evaluateCEL('x + y')).rejects.toThrow();
    });

    test('should handle null variables object', async () => {
      // This should work if the expression doesn't require variables
      const result = await evaluateCEL('10 + 20', null);
      expect(result.result).toBe(30);
    });
  });

  describe('Input validation', () => {
    test('should throw error for non-string expression', async () => {
      await expect(evaluateCEL(123)).rejects.toThrow(
        'First argument must be a string',
      );
    });

    test('should throw error for non-object variables', async () => {
      await expect(evaluateCEL('10 + 20', 'invalid')).rejects.toThrow(
        'Second argument must be an object (variables map or options) or null',
      );
    });
  });
});
