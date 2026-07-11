import ast

from conftest import SERVER_DIR, API_DIR

SOURCE_FILES = list(SERVER_DIR.glob("*.py")) + [API_DIR / "index.py"]


def _prompt_string_line_ranges(source):
    tree = ast.parse(source)
    ranges = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            if node.end_lineno is not None and node.end_lineno > node.lineno:
                ranges.append((node.lineno, node.end_lineno))
    return ranges


def _line_in_any_range(line_no, ranges):
    return any(start <= line_no <= end for start, end in ranges)


def test_no_hash_comment_lines_outside_multiline_strings():
    for path in SOURCE_FILES:
        source = path.read_text()
        multiline_ranges = _prompt_string_line_ranges(source)
        for i, line in enumerate(source.splitlines(), start=1):
            stripped = line.strip()
            if not stripped.startswith("#"):
                continue
            if _line_in_any_range(i, multiline_ranges):
                continue
            raise AssertionError(f"unexpected code comment at {path}:{i}: {line!r}")


def test_no_trailing_hash_comments_outside_multiline_strings():
    for path in SOURCE_FILES:
        source = path.read_text()
        multiline_ranges = _prompt_string_line_ranges(source)
        for i, line in enumerate(source.splitlines(), start=1):
            if _line_in_any_range(i, multiline_ranges):
                continue
            if "#" not in line:
                continue
            code_part = line.split("#", 1)[0]
            if '"' in code_part or "'" in code_part:
                continue
            raise AssertionError(f"unexpected trailing comment at {path}:{i}: {line!r}")
