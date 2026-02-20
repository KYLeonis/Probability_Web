import codecs
content = codecs.open('style.css', 'r', 'utf-8').read()

vars_old = """/* Global Variables */
:root {
    --primary-color: #8B0000;
    /* 合工大红 */
    --primary-hover: #A60000;
    --bg-color: #FFFFFF;
    --sidebar-bg: #F7F7F5;
    --text-main: #37352F;
    --text-secondary: #6B7280;
    --border-color: #E5E7EB;
    --card-hover-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    --font-main: 'Inter', 'Noto Sans SC', sans-serif;
    --sidebar-width: 260px;
    --header-height: 50px;
}"""

vars_new = """/* Global Variables */
:root {
    --primary-color: #8B0000;
    --primary-hover: #A60000;
    --bg-color: #f8f9fa;
    --text-color: #333333;
    --text-main: var(--text-color);
    --card-bg: #ffffff;
    --border-color: #e5e7eb;
    --sidebar-bg: var(--card-bg);
    --text-secondary: #6B7280;
    --hover-bg: #F3F4F6;
    --hover-bg-darker: #EBEBEA;
    --card-hover-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    --font-main: 'Inter', 'Noto Sans SC', sans-serif;
    --sidebar-width: 260px;
    --header-height: 50px;
}

[data-theme="dark"] {
    --bg-color: #121212;
    --text-color: #ffffff;
    --card-bg: #1e1e1e;
    --border-color: #333333;
    --sidebar-bg: var(--card-bg);
    --text-secondary: #9CA3AF;
    --hover-bg: #2d2d2d;
    --hover-bg-darker: #333333;
    --card-hover-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}"""
content = content.replace(vars_old, vars_new)

reps = {
    "background: #fff;": "background: var(--card-bg);",
    "background: #FFFFFF;": "background: var(--card-bg);",
    "background-color: #f8f9fa;": "background-color: var(--card-bg);",
    "background-color: #FDFDFD;": "background-color: var(--bg-color);",
    "background: #FDFDFD;": "background: var(--bg-color);",
    "border: 1px solid #F3F4F6;": "border: 1px solid var(--border-color);",
    "border-top: 1px solid #F3F4F6;": "border-top: 1px solid var(--border-color);",
    "border: 1px solid #F9FAFB;": "border: 1px solid var(--border-color);",
    "background-color: #F3F4F6;": "background-color: var(--hover-bg);",
    "background-color: #EBEBEA;": "background-color: var(--hover-bg-darker);",
    "background-color: #F9FAFB;": "background-color: var(--hover-bg);",
    "background-color: #EEEEEE;": "background-color: var(--hover-bg-darker);",
    "background-color: #ECECEB;": "background-color: var(--hover-bg-darker);",
    "background-color: #E3E2E0;": "background-color: var(--hover-bg-darker);",
    "background: #E5E7EB;": "background: var(--border-color);",
    "background-color: #e5e7eb;": "background-color: var(--border-color);",
    "color: #000;": "color: var(--text-main);",
    "color: #4B5563;": "color: var(--text-main);",
    "border: 2px solid #ffffff;": "border: 2px solid var(--card-bg);",
    "transition: transform 0.3s ease;": "transition: transform 0.3s ease, background-color 0.3s, border-color 0.3s;",
    "transition: box-shadow 0.2s;": "transition: box-shadow 0.2s, background-color 0.3s, border-color 0.3s;",
    "box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);": "box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);",
}
for o, n in reps.items():
    content = content.replace(o, n)

b_old = """body {
    font-family: var(--font-main);
    color: var(--text-main);
    background-color: var(--bg-color);
    height: 100vh;
    overflow: hidden;
    /* App-like feel */
}"""
b_new = """body {
    font-family: var(--font-main);
    color: var(--text-main);
    background-color: var(--bg-color);
    height: 100vh;
    overflow: hidden;
    transition: background-color 0.3s, color 0.3s;
    /* App-like feel */
}"""
content = content.replace(b_old, b_new)

# handle transition specifically for card
content = content.replace('transition: box-shadow 0.2s;', 'transition: box-shadow 0.2s, background-color 0.3s, border-color 0.3s, color 0.3s;')

codecs.open('style.css', 'w', 'utf-8').write(content)
print("CSS Updated successfully.")
