import re, json, sys, os

sys.stdout.reconfigure(encoding='utf-8')

folder = r"c:\Users\gagan\Downloads\Pundits\Full Mocks"

failed_files = [
    "26 by The Cgl 2025 pre (Hindi).html",
    "27 by The Cgl 2025 pre (Hindi).html",
    "29 by The Cgl 2025 pre (Hindi).html",
    "30 by The Cgl 2025 pre (Hindi).html",
]

def get_error(content):
    m = re.search(r'const questions\s*=\s*(\[.*?\]);\s*\n', content, re.DOTALL)
    if not m: return None, None
    raw = m.group(1)
    try:
        json.loads(raw)
        return None, raw  # valid
    except json.JSONDecodeError as e:
        return e, raw

def fix_file(filepath):
    name = os.path.basename(filepath)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    original = content
    fixes = []

    # ── Standard fixes first ──
    # D: series_name semicolon
    m_sn = re.search(r'"series_name":\s*"([^"]+)";\s*\n(\s*)const sectionsData', content)
    if m_sn:
        sn, indent = m_sn.group(1), m_sn.group(2)
        old = m_sn.group(0)
        new = f'"series_name": "{sn}"\n\n  }}\n];\n{indent}const sectionsData'
        content = content.replace(old, new)
        fixes.append("D: series_name;")

    # E: sectionsData commas
    if re.search(r'"name": "[^"]+""[ \t]*"timer"', content):
        content = re.sub(r'("name": "[^"]+")"([ \t]*"timer")', r'\1,\2', content)
        fixes.append("E: sectionsData comma")

    # ── Iterative: fix unescaped quotes by error position ──
    # Strategy: at each JSON error position in the raw string,
    # the char before (pos-1) is a `"` that's unescaped.
    # In the file content, find that exact context and add `\` before the `"`.

    for iteration in range(60):
        err, raw = get_error(content)
        if err is None:
            break  # valid!

        pos = err.pos
        if pos <= 0 or pos >= len(raw):
            fixes.append(f"STUCK: pos={pos} out of range")
            break

        # The bad char is at pos; the unescaped " is at pos-1
        if raw[pos-1] != '"':
            fixes.append(f"STUCK@{pos}: prev char is not quote: {repr(raw[pos-2:pos+2])}")
            break

        # Get unique context around the unescaped " (at pos-1 in raw)
        # We need to find this exact location in content and insert `\` before the `"`
        # Context window: 40 chars before and 40 chars after the bad `"`
        ctx_before = raw[max(0, pos-41):pos-1]   # 40 chars before the bad "
        ctx_after  = raw[pos:min(len(raw), pos+40)]  # 40 chars after the bad "

        # In content, the raw's `\\\"` appears as `\\"` (one level less escaping)
        # and the raw's `"` (unescaped) appears as `"` in content
        # We find: ctx_before + `"` + ctx_after in content
        # and replace with: ctx_before + `\"` + ctx_after

        # Use a shorter unique context to avoid multi-line issues
        search_before = raw[max(0, pos-20):pos-1]
        search_after  = raw[pos:min(len(raw), pos+20)]

        search_str = search_before + '"' + search_after
        replace_str = search_before + '\\"' + search_after

        if search_str in content:
            content = content.replace(search_str, replace_str, 1)
            # Get what was around the quote for logging
            log_ctx = raw[max(0,pos-15):pos+15].encode('ascii', errors='replace').decode('ascii')
            fixes.append(f"iter{iteration}: escaped \" @{pos} ctx={repr(log_ctx)}")
        else:
            # Try shorter context
            s2 = raw[max(0,pos-10):pos-1] + '"' + raw[pos:min(len(raw),pos+10)]
            r2 = raw[max(0,pos-10):pos-1] + '\\"' + raw[pos:min(len(raw),pos+10)]
            if s2 in content:
                content = content.replace(s2, r2, 1)
                fixes.append(f"iter{iteration}(short): escaped \" @{pos}")
            else:
                fixes.append(f"NOTFOUND@{pos}: {repr(search_str[:40].encode('ascii','replace').decode())}")
                break

    # ── Final verify ──
    err2, raw2 = get_error(content)
    success = (err2 is None)
    q_count = 0
    if success:
        m2 = re.search(r'const questions\s*=\s*(\[.*?\]);\s*\n', content, re.DOTALL)
        if m2:
            try: q_count = len(json.loads(m2.group(1)))
            except: pass

    if success and content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

    return name, success, q_count, fixes


for fname in failed_files:
    filepath = os.path.join(folder, fname)
    name, success, q_count, fixes = fix_file(filepath)
    status = "FIXED" if success else "FAIL "
    print(f"\n{status}  {name} ({q_count} Qs)")
    for fx in fixes:
        print(f"  -> {fx}")
