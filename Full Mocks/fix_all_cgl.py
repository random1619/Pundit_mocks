import re, json, sys, glob, os

sys.stdout.reconfigure(encoding='utf-8')

folder = r"c:\Users\gagan\Downloads\Pundits\Full Mocks"

# ── Target: all "N by The Cgl" files ──
all_files = sorted(glob.glob(os.path.join(folder, "* by The Cgl*.html")))
print(f"Found {len(all_files)} 'by The Cgl' files\n{'='*60}")

def try_parse_questions(content):
    m = re.search(r'const questions\s*=\s*(\[.*?\]);\s*\n', content, re.DOTALL)
    if not m:
        return None, None, "No questions array found"
    raw = m.group(1)
    try:
        parsed = json.loads(raw)
        return parsed, raw, None
    except json.JSONDecodeError as e:
        return None, raw, f"pos={e.pos} {e.msg}"

def fix_file(filepath):
    name = os.path.basename(filepath)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    original = content
    fixes = []

    # Quick pre-check
    parsed, raw, err = try_parse_questions(content)
    if parsed:
        return name, True, 0, ["Already valid"]

    # ── ITERATIVE FIX LOOP (up to 10 passes) ──
    for pass_num in range(10):
        parsed, raw, err = try_parse_questions(content)
        if parsed:
            break

        if not raw:
            fixes.append("ERROR: No questions array found")
            break

        # Get error position and context
        m_arr = re.search(r'const questions\s*=\s*(\[.*?\]);\s*\n', content, re.DOTALL)
        raw = m_arr.group(1)
        try:
            json.loads(raw)
            break
        except json.JSONDecodeError as e:
            pos = e.pos
            ctx = raw[max(0,pos-80):pos+80]
            ctx_safe = ctx.encode('ascii', errors='replace').decode('ascii')
            bad_char = raw[pos] if pos < len(raw) else 'EOF'

        applied = False

        # ── Fix A: 'FontName'"serif  →  'FontName',serif ──
        count_a = len(re.findall(r"'([^']+)'\"(serif|sans-serif|monospace)", raw))
        if count_a > 0:
            content = re.sub(r"'([^']+)'\"(serif|sans-serif|monospace)",
                             lambda m: f"'{m.group(1)}',{m.group(2)}", content)
            fixes.append(f"Fixed {count_a} 'FontName'\"serif patterns")
            applied = True
            continue

        # ── Fix B: Roboto" sans-serif  →  Roboto, sans-serif ──
        count_b = len(re.findall(r'font-family:\s*[A-Za-z][^;"\\,]*"[\s]*(sans-serif|serif|monospace)', raw))
        if count_b > 0:
            content = re.sub(r'(font-family:\s*[A-Za-z][^;"\\,]*)"([\s]*(?:sans-serif|serif|monospace))',
                             lambda m: m.group(0).replace('"', ',', 1), content)
            # More targeted fix
            content = re.sub(r'(font-family:\s*(?:[A-Za-z][^,"\\;]*?))"(\s*(?:sans-serif|serif|monospace))',
                             r'\1,\2', content)
            fixes.append(f"Fixed {count_b} FontName\" sans-serif patterns")
            applied = True
            continue

        # ── Fix C: Corrupted tokens ──
        for token, replacement in [
            ('Champion#', 'Australia'),
            ('Exampl# ', 'Example: "'),
            ('Exampl#>', 'Example: "</b>'),
            ('Hind#"', 'Hindi: "'),
            ('Hind#>', 'Hindi: "</b>'),
        ]:
            if token in content:
                n = content.count(token)
                content = content.replace(token, replacement)
                fixes.append(f"Fixed {n} {token} tokens")
                applied = True

        # ── Fix D: "series_name": "..."; \n const sectionsData  →  proper closing ──
        # Find all series_name values in this file
        sn_matches = re.findall(r'"series_name":\s*"([^"]+)";\s*\n\s*const sectionsData', content)
        for sn_val in sn_matches:
            bad = f'"series_name": "{sn_val}";\n        const sectionsData'
            good = f'"series_name": "{sn_val}"\n\n  }}\n];\n        const sectionsData'
            if bad in content:
                content = content.replace(bad, good)
                fixes.append(f"Fixed missing }}] after series_name")
                applied = True

        # Also try with different whitespace
        m_bad_end = re.search(r'"series_name":\s*"([^"]+)";\s*\n(\s*)const sectionsData', content)
        if m_bad_end:
            sn_val = m_bad_end.group(1)
            indent = m_bad_end.group(2)
            old = m_bad_end.group(0)
            new = f'"series_name": "{sn_val}"\n\n  }}\n];\n{indent}const sectionsData'
            content = content.replace(old, new)
            fixes.append(f"Fixed missing }}] (whitespace-aware)")
            applied = True

        # ── Fix E: sectionsData missing commas ──
        count_e = len(re.findall(r'"name": "[^"]+""[ \t]*"timer"', content))
        if count_e > 0:
            content = re.sub(r'("name": "[^"]+")"([ \t]*"timer")', r'\1,\2', content)
            fixes.append(f"Fixed {count_e} sectionsData commas")
            applied = True

        # ── Fix F: Inline style color:#000 unescaped quote before word ──
        # Pattern: color: #000000; font-family: Roboto" sans-serif
        # Already handled in Fix B

        # ── Fix G: Unescaped quote in other inline styles ──
        # e.g. font-size: 18px; text-align: justify;">\nSomeText
        # This is harder to detect generically - try specific at error pos
        if pos < len(raw) and bad_char == 's':
            before_err = raw[max(0,pos-50):pos]
            # Look for pattern like: font-family: Something" s (where s starts sans-serif)
            m_ff = re.search(r'font-family:\s*([^;"\\]+)"$', before_err)
            if m_ff:
                font_name = m_ff.group(1).rstrip()
                # Find and fix this specific instance
                bad_pattern = f'font-family: {font_name}"'
                good_pattern = f'font-family: {font_name},'
                if bad_pattern in content:
                    content = content.replace(bad_pattern, good_pattern, 1)
                    fixes.append(f"Fixed specific font-family: {font_name}\" -> ,")
                    applied = True

        if not applied:
            fixes.append(f"UNRESOLVED: {err} | ctx={ctx_safe[:60]}")
            break

    # ── Fix E final pass: sectionsData commas ──
    count_e = len(re.findall(r'"name": "[^"]+""[ \t]*"timer"', content))
    if count_e > 0:
        content = re.sub(r'("name": "[^"]+")"([ \t]*"timer")', r'\1,\2', content)
        fixes.append(f"Fixed {count_e} sectionsData commas (final pass)")

    # ── Final verify ──
    parsed2, raw2, err2 = try_parse_questions(content)
    success = parsed2 is not None
    q_count = len(parsed2) if parsed2 else 0

    if success and content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

    return name, success, q_count, fixes


# ── RUN ──
total = 0
fixed = 0
already_ok = 0
failed = []

for filepath in all_files:
    name, success, q_count, fixes = fix_file(filepath)
    total += 1

    if fixes == ["Already valid"]:
        already_ok += 1
        print(f"  OK  {name}")
        continue

    if success:
        fixed += 1
        print(f"  FIXED  {name} ({q_count} Qs) | {', '.join(fixes)}")
    else:
        failed.append(name)
        print(f"  FAIL   {name} | {', '.join(fixes)}")

print(f"\n{'='*60}")
print(f"Total: {total} | Already OK: {already_ok} | Fixed: {fixed} | Failed: {len(failed)}")
if failed:
    print(f"\nFailed files:")
    for f in failed:
        print(f"  - {f}")
