import os
import json
import urllib.parse
import html
import re

def natural_sort_key(s):
    """Key for natural sorting (e.g., 'Mock 2' comes before 'Mock 10')"""
    return [int(text) if text.isdigit() else text.lower() for text in re.split('([0-9]+)', s)]

def generate_dashboard():
    # Use the script's directory as the root directory to be more robust
    root_dir = os.path.dirname(os.path.abspath(__file__))
    dashboard_file = os.path.join(root_dir, 'index.html')
    
    exclude_dirs = {'.git', '.vscode', 'node_modules', '.trae', 'venv', '__pycache__', 'css', 'js', 'scss', 'assets'}
    exclude_files = {'index.html', 'package.json', 'package-lock.json', 'generate_dashboard.py', '.gitignore', 'README.md'}
    
    html_template = """<!DOCTYPE html>
<html lang="en" data-bs-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pundits | Mocks Dashboard</title>
    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎓</text></svg>">
    
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        :root {
            --glass-bg: rgba(255, 255, 255, 0.7);
            --glass-border: rgba(255, 255, 255, 0.3);
            --primary-gradient: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
        }

        [data-bs-theme="dark"] {
            --glass-bg: rgba(30, 41, 59, 0.7);
            --glass-border: rgba(255, 255, 255, 0.1);
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: #f8fafc;
            color: #1e293b;
            min-height: 100vh;
            transition: background-color 0.3s ease;
        }

        [data-bs-theme="dark"] body {
            background-color: #0f172a;
            color: #f1f5f9;
        }

        .navbar {
            background: var(--glass-bg);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--glass-border);
            position: sticky;
            top: 0;
            z-index: 1000;
        }

        .hero-section {
            padding: 60px 0 40px;
            background: var(--primary-gradient);
            color: white;
            border-radius: 0 0 40px 40px;
            margin-bottom: -40px;
        }

        .search-container {
            max-width: 700px;
            margin: 0 auto;
            position: relative;
            z-index: 10;
        }

        .search-input {
            height: 60px;
            border-radius: 16px;
            padding-left: 50px;
            border: 1px solid var(--glass-border);
            background: var(--glass-bg);
            backdrop-filter: blur(8px);
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
            font-size: 1.1rem;
        }

        .search-icon {
            position: absolute;
            left: 18px;
            top: 50%;
            transform: translateY(-50%);
            color: #64748b;
        }

        .category-card {
            background: var(--glass-bg);
            backdrop-filter: blur(8px);
            border: 1px solid var(--glass-border);
            border-radius: 20px;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            height: 100%;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .category-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }

        .category-header {
            padding: 20px;
            background: rgba(99, 102, 241, 0.1);
            border-bottom: 1px solid var(--glass-border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
            user-select: none;
        }

        .mock-list {
            list-style: none;
            padding: 0;
            margin: 0;
            max-height: 400px;
            overflow-y: auto;
        }

        .mock-item {
            padding: 12px 20px;
            border-bottom: 1px solid var(--glass-border);
            transition: background 0.2s;
        }

        .mock-item:last-child {
            border-bottom: none;
        }

        .mock-item:hover {
            background: rgba(99, 102, 241, 0.05);
        }

        .mock-link {
            text-decoration: none;
            color: inherit;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.95rem;
        }

        .mock-link:hover {
            color: #6366f1;
        }

        .badge-count {
            background: #6366f1;
            color: white;
            padding: 4px 10px;
            border-radius: 8px;
            font-size: 0.8rem;
        }

        .theme-toggle {
            cursor: pointer;
            padding: 8px;
            border-radius: 12px;
            border: 1px solid var(--glass-border);
            background: var(--glass-bg);
            transition: all 0.2s;
        }
        
        .theme-toggle:hover {
            transform: scale(1.1);
            background: rgba(99, 102, 241, 0.1);
        }

        ::-webkit-scrollbar {
            width: 6px;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 10px;
        }
        [data-bs-theme="dark"] ::-webkit-scrollbar-thumb {
            background: #475569;
        }

        .empty-state {
            text-align: center;
            padding: 40px;
            display: none;
        }
        
        .fade-in {
            animation: fadeIn 0.5s ease-in;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body>
    <nav class="navbar">
        <div class="container">
            <a class="navbar-brand d-flex align-items-center gap-2" href="#">
                <div class="bg-primary rounded-3 p-1">
                    <i data-lucide="graduation-cap" class="text-white" style="width: 24px; height: 24px;"></i>
                </div>
                <span class="fw-bold tracking-tight">PUNDITS</span>
            </a>
            <div class="d-flex align-items-center gap-3">
                <button class="theme-toggle" id="themeToggle" title="Toggle Theme" aria-label="Toggle Theme">
                    <i data-lucide="sun" id="themeIcon"></i>
                </button>
            </div>
        </div>
    </nav>

    <section class="hero-section">
        <div class="container text-center">
            <h1 class="fw-bold mb-3">Mock Test Dashboard</h1>
            <p class="opacity-75 mb-5">Access all your practice materials in one modern interface</p>
        </div>
    </section>

    <div class="container mb-5">
        <div class="search-container mb-5">
            <i data-lucide="search" class="search-icon"></i>
            <input type="text" id="searchInput" class="form-control search-input" placeholder="Search by mock name or category..." aria-label="Search mocks">
        </div>

        <div class="row g-4" id="dashboardContent">
            <!-- Content will be injected here -->
            {{CONTENT}}
        </div>

        <div id="emptyState" class="empty-state mt-5">
            <i data-lucide="search-x" style="width: 64px; height: 64px;" class="mb-3 opacity-50"></i>
            <h3>No mocks found</h3>
            <p class="text-muted">Try adjusting your search terms</p>
        </div>
    </div>

    <footer class="container py-5 mt-5 border-top">
        <div class="text-center text-muted small">
            &copy; 2026 Pundits Dashboard. All rights reserved.
        </div>
    </footer>

    <script>
        // Initialize Lucide icons
        lucide.createIcons();

        // Theme Toggle Logic
        const themeToggle = document.getElementById('themeToggle');
        const htmlElement = document.documentElement;
        const themeIcon = document.getElementById('themeIcon');

        const savedTheme = localStorage.getItem('theme') || 'light';
        htmlElement.setAttribute('data-bs-theme', savedTheme);
        updateThemeIcon(savedTheme);

        themeToggle.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-bs-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            htmlElement.setAttribute('data-bs-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        });

        function updateThemeIcon(theme) {
            themeIcon.setAttribute('data-lucide', theme === 'light' ? 'moon' : 'sun');
            lucide.createIcons();
        }

        // Search Logic
        const searchInput = document.getElementById('searchInput');
        const categoryCards = document.querySelectorAll('.category-section');
        const emptyState = document.getElementById('emptyState');

        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            let hasVisibleCards = false;

            categoryCards.forEach(card => {
                const categoryTitle = card.querySelector('.category-title').textContent.toLowerCase();
                const mockItems = card.querySelectorAll('.mock-item');
                let cardHasVisibleMocks = false;

                mockItems.forEach(item => {
                    const mockName = item.querySelector('.mock-link').textContent.toLowerCase();
                    if (mockName.includes(term) || categoryTitle.includes(term)) {
                        item.style.display = 'block';
                        cardHasVisibleMocks = true;
                    } else {
                        item.style.display = 'none';
                    }
                });

                if (cardHasVisibleMocks) {
                    card.style.display = 'block';
                    hasVisibleCards = true;
                } else {
                    card.style.display = 'none';
                }
            });

            emptyState.style.display = hasVisibleCards ? 'none' : 'block';
        });

        // Toggle category lists
        function toggleCategory(id) {
            const list = document.getElementById(id);
            const header = list.previousElementSibling;
            const icon = header.querySelector('.chevron-icon');
            if (list.classList.contains('d-none')) {
                list.classList.remove('d-none');
                icon.style.transform = 'rotate(180deg)';
            } else {
                list.classList.add('d-none');
                icon.style.transform = 'rotate(0deg)';
            }
        }
    </script>
</body>
</html>
"""

    categories_html = ""
    categories = []
    
    try:
        for item in sorted(os.listdir(root_dir)):
            item_path = os.path.join(root_dir, item)
            if os.path.isdir(item_path) and item not in exclude_dirs:
                categories.append(item)

        for idx, category in enumerate(categories):
            cat_path = os.path.join(root_dir, category)
            mocks = []
            
            for root, dirs, files in os.walk(cat_path):
                # Filter out excluded directories in the walk
                dirs[:] = [d for d in dirs if d not in exclude_dirs]
                
                for file in files:
                    if file.endswith('.html') and file not in exclude_files:
                        rel_path = os.path.relpath(os.path.join(root, file), root_dir).replace('\\', '/')
                        # URL encode the path but keep forward slashes
                        safe_path = urllib.parse.quote(rel_path).replace('%2B', '+') # Keep '+' signs as they are common in filenames
                        mocks.append({
                            'name': file.replace('.html', ''), 
                            'path': safe_path
                        })
            
            if mocks:
                # Use natural sorting for mock names
                mocks.sort(key=lambda x: natural_sort_key(x['name']))
                cat_id = f"cat_{idx}"
                safe_category = html.escape(category)
                
                categories_html += f"""
                <div class="col-md-6 col-lg-4 category-section fade-in">
                    <div class="category-card">
                        <div class="category-header" onclick="toggleCategory('{cat_id}')" role="button" aria-expanded="true" aria-controls="{cat_id}">
                            <div class="d-flex align-items-center gap-2">
                                <i data-lucide="folder" style="width: 20px; height: 20px; color: #6366f1;"></i>
                                <span class="fw-semibold category-title">{safe_category}</span>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge-count">{len(mocks)}</span>
                                <i data-lucide="chevron-down" class="chevron-icon" style="width: 18px; height: 18px; transition: transform 0.3s; transform: rotate(0deg);"></i>
                            </div>
                        </div>
                        <ul class="mock-list" id="{cat_id}">
                """
                
                for mock in mocks:
                    safe_mock_name = html.escape(mock['name'])
                    categories_html += f"""
                            <li class="mock-item">
                                <a href="{mock['path']}" class="mock-link" target="_blank">
                                    <i data-lucide="file-text" style="width: 16px; height: 16px; opacity: 0.6;"></i>
                                    <span class="text-truncate" title="{safe_mock_name}">{safe_mock_name}</span>
                                </a>
                            </li>
                    """
                
                categories_html += """
                        </ul>
                    </div>
                </div>
                """

        final_html = html_template.replace("{{CONTENT}}", categories_html)
        
        with open(dashboard_file, 'w', encoding='utf-8') as f:
            f.write(final_html)
        print(f"Modern dashboard generated successfully at {dashboard_file}")

    except Exception as e:
        print(f"An error occurred while generating the dashboard: {e}")

if __name__ == "__main__":
    generate_dashboard()
