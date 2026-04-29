import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "url";

import { resolveDesignImagePath } from "../../src/electron/libs/design-image-path.js";

describe("design image path resolution", () => {
  it("converts file URI image paths into local filesystem paths", () => {
    const filePath = "D:\\tmp\\reference.png";
    assert.equal(resolveDesignImagePath(pathToFileURL(filePath).toString(), "图片路径"), filePath);
  });

  it("rejects placeholder image filenames with actionable guidance", () => {
    assert.throws(
      () => resolveDesignImagePath("image.png", "图片路径"),
      /不要传入占位文件名 image\.png/,
    );
  });
});
