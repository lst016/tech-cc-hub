import os, re, yaml

required_fields = ['doc_id','title','doc_type','layer','status','version','last_updated','owners','tags']
doc_dir = 'doc'
issues = []

for root, dirs, files in os.walk(doc_dir):
    for f in files:
        if not f.endswith('.md'):
            continue
        path = os.path.join(root, f)
        with open(path, encoding='utf-8') as fh:
            content = fh.read()
        if not content.startswith('---'):
            issues.append((path, 'NO_FRONTMATTER', 'Missing front matter entirely'))
            continue
        match = re.match(r'^---\s*\n(.*?)\n---', content, re.DOTALL)
        if not match:
            issues.append((path, 'BAD_FRONTMATTER', 'Cannot parse front matter'))
            continue
        try:
            fm = yaml.safe_load(match.group(1))
        except Exception as e:
            issues.append((path, 'YAML_ERROR', str(e)))
            continue
        if not isinstance(fm, dict):
            issues.append((path, 'NOT_DICT', 'Front matter is not a mapping'))
            continue
        missing = [f for f in required_fields if f not in fm]
        if missing:
            issues.append((path, 'MISSING_FIELDS', ', '.join(missing)))
        h1_match = re.search(r'^#\s+(.+)$', content[match.end():], re.MULTILINE)
        if h1_match and 'title' in fm:
            h1 = h1_match.group(1).strip()
            fm_title = fm['title'].strip()
            if h1 != fm_title and not fm_title.startswith(h1) and not h1.startswith(fm_title):
                issues.append((path, 'TITLE_MISMATCH', f'fm="{fm_title}" vs h1="{h1}"'))

print(f'Total issues: {len(issues)}')
for path, kind, detail in sorted(issues):
    print(f'{kind}: {path} — {detail}')
