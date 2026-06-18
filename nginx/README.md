# nginx config (host: 31.97.13.54)

Snapshot of the host's `/etc/nginx`, mirroring its directory layout.
Stock Debian files (mime.types, fastcgi_params, snakeoil, etc.) are omitted —
only the meaningful/custom config is tracked.

## Architecture

Port `:443` is shared between Xray (VLESS/xHTTP camouflage) and a Miniflux
HTTPS vhost via **SNI-based TLS demultiplexing** (no TLS termination at the
demux layer):

```
              :443 (stream, ssl_preread)        stream-enabled/demux.conf
                       │  routes by SNI
   reader.yjjvip.uk ──┼──▶ 127.0.0.1:8444  nginx TLS vhost   conf.d/reader.conf
                       │                       └─▶ 127.0.0.1:8080  miniflux
   yjjvip.uk / other ─┴──▶ 127.0.0.1:8443  xray (own TLS)
```

Plain `:80`
- `reader.yjjvip.uk` → ACME challenges + redirect to HTTPS (conf.d/reader.conf)
- `rss.yjjvip.uk`   → reverse proxy to RSSHub `127.0.0.1:1200` (sites-available/rsshub)
- default server    → static `/var/www/html` (sites-available/default)

## Files

| Path                          | Role                                                        |
|-------------------------------|-------------------------------------------------------------|
| `nginx.conf`                  | main config; includes `stream-enabled/` and `conf.d/`       |
| `stream-enabled/demux.conf`   | `:443` SNI demux → 8444 (miniflux) / 8443 (xray)            |
| `conf.d/reader.conf`          | TLS vhost on 8444 → miniflux; `:80` ACME + HTTPS redirect   |
| `sites-available/rsshub`      | `rss.yjjvip.uk:80` → RSSHub :1200                           |
| `sites-available/default`     | default `:80` static server                                 |
| `sites-enabled/_ENABLED.txt`  | which sites-available entries are symlinked/active          |

> TLS certs (`/etc/letsencrypt/...`) are **not** included.

## Restore

Copy files back under `/etc/nginx/` preserving paths, re-create the
`sites-enabled/` symlinks per `_ENABLED.txt`, then `nginx -t && systemctl reload nginx`.
