import os
import re
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request
import markdown_it
from markdown_it import MarkdownIt

VAULT_PATH = Path(os.environ.get("OBSIDIAN_VAULT_PATH", "/root/obsidian-vault")).resolve()
APP_DIR = Path(__file__).resolve().parent.parent

app = FastAPI(title="Vault Reader")
app.mount("/static", StaticFiles(directory=APP_DIR / "static"), name="static")
templates = Jinja2Templates(directory=APP_DIR / "templates")

md = (
    MarkdownIt("commonmark", {"html": False, "linkify": True, "typographer": True})
    .enable(["table", "strikethrough"])
)

import html as _html

WIKILINK_RE = re.compile(r"\[\[([^\]\|#]+)(?:#[^\]\|]+)?(?:\|([^\]]+))?\]\]")


def safe_resolve(rel: str) -> Path:
    p = (VAULT_PATH / rel).resolve()
    if not str(p).startswith(str(VAULT_PATH)):
        raise HTTPException(400, "Invalid path")
    return p


def list_notes():
    items = []
    for p in sorted(VAULT_PATH.rglob("*.md")):
        if any(part.startswith(".") for part in p.relative_to(VAULT_PATH).parts):
            continue
        items.append(str(p.relative_to(VAULT_PATH)))
    return items


def _wikilink_repl(m):
    target = m.group(1).strip()
    label = (m.group(2) or target).strip()
    return (
        f'<a class="wikilink" href="#" data-target="{_html.escape(target, quote=True)}">'
        f"{_html.escape(label)}</a>"
    )


def _transform_wikilinks_in_html(rendered: str) -> str:
    """Replace [[wikilink]] only outside <code>/<pre> blocks."""
    parts = re.split(r"(<pre[\s\S]*?</pre>|<code[\s\S]*?</code>)", rendered)
    for i, part in enumerate(parts):
        if i % 2 == 0:
            parts[i] = WIKILINK_RE.sub(_wikilink_repl, part)
    return "".join(parts)


def render_md(text: str) -> str:
    return _transform_wikilinks_in_html(md.render(text))


@app.get("/api/notes")
def api_notes():
    return {"vault": str(VAULT_PATH), "notes": list_notes()}


@app.get("/api/note")
def api_note(path: str = Query(...)):
    p = safe_resolve(path)
    if not p.exists() or not p.is_file():
        raise HTTPException(404, "Not found")
    text = p.read_text(encoding="utf-8", errors="replace")
    title = p.stem
    m = re.match(r"^#\s+(.+)$", text, re.M)
    if m:
        title = m.group(1).strip()
    html = render_md(text)
    return {"path": path, "title": title, "html": html}


@app.get("/api/resolve")
def api_resolve(target: str):
    # find a note by stem matching the wikilink target
    target_norm = target.strip().lower()
    for note in list_notes():
        if Path(note).stem.lower() == target_norm:
            return {"path": note}
    raise HTTPException(404, "Wikilink target not found")


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "vault": str(VAULT_PATH)},
    )
