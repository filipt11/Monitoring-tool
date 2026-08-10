# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = 'Monitoring Tool'
copyright = '2026, Filip Terzyk'
author = 'Filip Terzyk'
release = '1.0'

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration
import os
import sys
sys.path.insert(0, os.path.abspath('..'))
sys.path.insert(0, os.path.abspath('../poller'))
sys.path.insert(0, os.path.abspath('../simulator'))

extensions = [
	'sphinx.ext.autodoc',
	'sphinx.ext.napoleon',
	'sphinx.ext.viewcode',
	'sphinx.ext.coverage',
]

templates_path = ['_templates']
exclude_patterns = ['_build', 'Thumbs.db', '.DS_Store']

# -- Autodoc configuration ------------------------------------------
autodoc_default_options = {
	'members': True,
	'member-order': 'bysource',
	'undoc-members': True,
	'show-inheritance': True,
}

# Napoleon configuration (Google/NumPy style docstrings)
napoleon_google_docstring = True
napoleon_numpy_docstring = True
napoleon_include_private_members = False
napoleon_include_special_members = False

autodoc_mock_imports = [
	'fastapi',
	'fastapi.security',
	'uvicorn',
	'httpx',
	'loguru',
	'influxdb_client',
	'sqlalchemy',
	'pydantic_settings',
]

# Autodoc member order
autodoc_member_order = 'bysource'


# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = 'sphinx_rtd_theme'

html_theme_options = {
	'logo_only': False,
	'display_version': True,
	'prev_next_buttons_location': 'bottom',
	'style_external_links': False,
	'style_nav_header_background': '#2c3e50',
	'collapse_navigation': True,
	'sticky_navigation': True,
	'navigation_depth': 4,
	'includehidden': True,
	'titles_only': False
}
html_static_path = ['_static']
