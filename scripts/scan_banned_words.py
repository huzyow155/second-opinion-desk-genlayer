import os
import re
import sys

# Comprehensive banned words list per GenLayer Studionet project rules:
# - 'cryptographic proof'
# - 'tamper-proof' / 'tamperproof'
# - 'bytecode'
# - 'finalized' (unless actual status_name literally equals FINALIZED)
# - 'testnet'
# - 'Live' / 'live'
# - 'unanimous' / 'unanimously'

BANNED_PATTERNS = [
    (r'\bcryptographic\s+proof\b', 'cryptographic proof'),
    (r'\btamper-?proof\b', 'tamper-proof'),
    (r'\bbytecode\b', 'bytecode'),
    (r'\btestnet\b', 'testnet'),
    (r'\bunanimous(ly)?\b', 'unanimous'),
    (r'\blive\b', 'live'),
    (r'\bfinalized\b', 'finalized'),
]

IGNORE_DIRS = {'.git', 'node_modules', 'dist', '__pycache__', '.vercel'}
ALLOWED_FILES = {'scan_banned_words.py'}

# contracts-reference/ holds byte-for-byte read-only contract copies.
# MirrorJudge.py has `raise gl.vm.UserError("case is finalized")` which is part of the immutable contract code.
ALLOWED_DIRS_FOR_PATTERNS = {
    'finalized': {'contracts-reference'}
}

def scan():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    violations = []
    
    for r, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        rel_dir = os.path.relpath(r, root).replace('\\', '/')
        for f in files:
            if f in ALLOWED_FILES:
                continue
            if not f.endswith(('.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.html', '.py', '.css', '.mjs')):
                continue
            path = os.path.join(r, f)
            rel_path = os.path.relpath(path, root).replace('\\', '/')
            
            with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                for line_idx, line in enumerate(fp, 1):
                    for pat, name in BANNED_PATTERNS:
                        # Check exceptions
                        if name in ALLOWED_DIRS_FOR_PATTERNS:
                            allowed_dirs = ALLOWED_DIRS_FOR_PATTERNS[name]
                            if any(rel_path.startswith(ad) for ad in allowed_dirs):
                                continue
                        
                        # Allowed check for literal status code check: e.g. status_name === 'FINALIZED'
                        if name == 'finalized' and ("=== 'FINALIZED'" in line or '=== "FINALIZED"' in line or "=== `FINALIZED`" in line):
                            continue
                        
                        m = re.search(pat, line, re.IGNORECASE)
                        if m:
                            violations.append((rel_path, line_idx, m.group(0), line.strip()))
    
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
