from repowiki.core.scanner import scan_directory


def test_scan_skips_minified_suffixes(tmp_path):
    (tmp_path / "app.min.js").write_text("console.log('packed');", encoding="utf-8")
    (tmp_path / "app.js").write_text("console.log('source');\n", encoding="utf-8")

    files = scan_directory(tmp_path)
    paths = {f.path for f in files}

    assert "app.js" in paths
    assert "app.min.js" not in paths


def test_scan_skips_generated_bundle_lines(tmp_path):
    assets = tmp_path / "src" / "server" / "static" / "assets"
    assets.mkdir(parents=True)
    (assets / "chunk-ABC123.js").write_text("const bundle='" + ("x" * 5000) + "';", encoding="utf-8")
    source = tmp_path / "src" / "main.js"
    source.write_text("export function main() {\n  return 42;\n}\n", encoding="utf-8")

    files = scan_directory(tmp_path)
    paths = {f.path.replace("\\", "/") for f in files}

    assert "src/main.js" in paths
    assert "src/server/static/assets/chunk-ABC123.js" not in paths
