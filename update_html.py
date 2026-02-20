import codecs
import re

content = codecs.open('index.html', 'r', 'utf-8').read()

btn1_pattern = r'<button class="utility-btn" aria-label="日间模式".*?</button>'
btn1_replacement = """<button class="utility-btn" id="theme-toggle" aria-label="切换主题">
            <svg class="sun-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            <svg class="moon-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
        </button>"""

content = re.sub(btn1_pattern, btn1_replacement, content, flags=re.DOTALL, count=1)

utility_pattern = r'(<div id="utility-header">.*?<div class="utility-avatar">)'
def replace_stroke(m):
    return m.group(1).replace('stroke="#4B5563"', 'stroke="currentColor"')

content = re.sub(utility_pattern, replace_stroke, content, flags=re.DOTALL)

codecs.open('index.html', 'w', 'utf-8').write(content)
print("HTML Updated successfully.")
