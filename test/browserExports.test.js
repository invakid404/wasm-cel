import * as browser from "../dist/browser.js";
import * as main from "../dist/index.js";

describe("browser entry exports", () => {
  test("re-exports optionalType from the browser entry", () => {
    expect(browser).toHaveProperty("optionalType");
    expect(browser.optionalType).toBe(main.optionalType);
    expect(browser).toHaveProperty("CELFunction");
    expect(browser.CELFunction).toBe(main.CELFunction);
    expect(browser).toHaveProperty("listType");
    expect(browser.listType).toBe(main.listType);
    expect(browser).toHaveProperty("mapType");
    expect(browser.mapType).toBe(main.mapType);
  });
});
