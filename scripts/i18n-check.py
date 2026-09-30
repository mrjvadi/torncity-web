#!/usr/bin/env python3
"""Lists keys of src/i18n/fa.ts that have no English line in en.ts (ui.src.txt
cannot drift: one line holds both languages). Exit 1 when any is missing."""
import re, os, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
keys = lambda f: set(re.findall(r"^\s*'([^']+)':", open(os.path.join(root, 'src/i18n', f), encoding='utf-8').read(), re.M))
missing = sorted(keys('fa.ts') - keys('en.ts'))
for k in missing: print('missing en:', k)
print(len(missing), 'missing')
sys.exit(1 if missing else 0)
