import os
import re
import sys

BANNED_WORDS = [
    r'\bcryptographic\s+proof\b',
    r'\btamper-proof\b',
    r'\btamperproof\b',
    r'\bbytecode\b',
    r'\btestnet\b',
    r'\bunanimous\b',
    r'\bunanimously\b',
]

IGNORE_DIRS = {'.git', 'node_modules', 'dist', '__pycache__'}
ALLOWED_FILES = {'scan_banned_words.py'}

def scan():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    violations = []
    
    for r, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for f in files:
            if f in ALLOWED_FILES:
                continue
            if not f.endswith(('.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.html', '.py', '.css')):
                continue
            path = os.path.join(r, f)
            with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                for line_idx, line in enumerate(fp, 1):
                    for pat in BANNED_WORDS:
                        m = re.search(pat, line, re.IGNORECASE)
                        if m:
                            violations.append((path, line_idx, m.group(0), line.strip()))
    
    if violations:
        print(f"FAILED: Found {len(violations)} banned word violations:")
        for path, line_no, matched, text in violations:
            print(f"  {path}:{line_no} [{matched}] -> {text[:100]}")
        sys.exit(1)
    else:
        print("PASSED: Zero banned words detected across codebase and docs.")
        sys.exit(0)

if __name__ == '__main__':
    scan()
