# Miniflux API — creating & using an API key

Miniflux on this host runs as a Docker container (`miniflux-miniflux-1`,
`miniflux/miniflux:latest`), bound to `127.0.0.1:8080`, and is published to the
internet as **https://reader.yjjvip.uk** through the nginx SNI demux
(see `../nginx/`).

The REST API is documented upstream: https://miniflux.app/docs/api.html

---

## 1. Create an API key

### Option A — Web UI (recommended)

1. Sign in at https://reader.yjjvip.uk
2. **Settings → API Keys → Create a new API key**
3. Give it a description and copy the generated token (shown once).

### Option B — Directly in PostgreSQL (fallback / automation)

Miniflux stores API tokens **in plaintext** in the `api_keys` table, so a key
can be injected without the UI. Useful for scripted/headless setup.

```sql
-- user_id 1 = quantsaas, 2 = admin (both are admins)
INSERT INTO api_keys (user_id, token, description)
VALUES (1, '<RANDOM_TOKEN>', 'my-key')
ON CONFLICT (user_id, description) DO UPDATE SET token = EXCLUDED.token;
```

Generate a token with `python3 -c "import secrets;print(secrets.token_hex(24))"`.
DB connection details live in `/root/miniflux/docker-compose.yml` (`DATABASE_URL`);
the password is **not** committed here.

Remove a temporary key when done:

```sql
DELETE FROM api_keys WHERE description = 'my-key';
```

---

## 2. Authentication

All requests pass the token in the `X-Auth-Token` header.

```
Base URL (public):  https://reader.yjjvip.uk/v1
Base URL (on host): http://127.0.0.1:8080/v1
Header:             X-Auth-Token: <TOKEN>
```

> Note: `curl`/`wget` are blocked by policy on this host; examples below use
> Python's stdlib so they run anywhere.

---

## 3. Common calls

```python
import urllib.request, json

TOKEN = "<TOKEN>"
BASE  = "http://127.0.0.1:8080/v1"   # or https://reader.yjjvip.uk/v1

def req(path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method,
        headers={"X-Auth-Token": TOKEN, "Content-Type": "application/json"})
    resp = urllib.request.urlopen(r, timeout=60)
    return resp.status, resp.read().decode()

print(req("/me"))            # current user
print(req("/categories"))    # list categories
print(req("/feeds"))         # list feeds
```

| Method & path                | Purpose                          |
|------------------------------|----------------------------------|
| `GET  /v1/me`                | Current user / verify the token  |
| `GET  /v1/categories`        | List categories (need an id)     |
| `GET  /v1/feeds`             | List all feeds                   |
| `POST /v1/feeds`             | Add a feed                       |
| `PUT  /v1/feeds/{id}`        | Update a feed (e.g. title)       |
| `GET  /v1/feeds/{id}/entries`| List a feed's entries            |
| `PUT  /v1/feeds/{id}/refresh`| Force a refresh                  |
| `DELETE /v1/feeds/{id}`      | Remove a feed                    |

---

## 4. Worked example — add an RSSHub feed

The forum search page `https://t66y.com/thread0806.php?fid=7&search=622066`
is not RSS, so it is converted by the local **RSSHub** container. Both
containers share the Docker `shared` network, so Miniflux reaches RSSHub by
its service alias `rsshub:1200` (it cannot use `host.docker.internal`, because
RSSHub is bound only to the host's `127.0.0.1`).

RSSHub t66y route: `/:id/:type?/:search?` → builds `thread0806.php?fid=<id>&search=<search>`.
Use type placeholder `-999` to keep the keyword search, i.e. `/t66y/7/-999/622066`.

```python
# 1. create the feed
status, out = req("/feeds", "POST", {
    "feed_url":    "http://rsshub:1200/t66y/7/-999/622066",
    "category_id": 1,            # the "All" category
})
feed_id = json.loads(out)["feed_id"]

# 2. give it a clean title (RSSHub emits "[undefined]" for non-preset searches)
req(f"/feeds/{feed_id}", "PUT", {"title": "t66y 技術討論區 fid7 search=622066"})
```

This is exactly how the `t66y 技術討論區 fid7 search=622066` feed was created.
