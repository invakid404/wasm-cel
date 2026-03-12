import * as browser from "../dist/browser.js";
import * as main from "../dist/index.js";

describe("browser entry exports", () => {
  test("re-exports optionalType from the browser entry", () => {
    expect(browser).toHaveProperty("optionalType");
    expect(browser.optionalType).toBe(main.optionalType);
  });
});
