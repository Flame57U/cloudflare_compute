# PgBouncer config (QuantSaaS / VPS 31.97.13.54)

Connection pooler in front of PostgreSQL 16. Sits on `:6432`, pools to the local
Postgres backend on `127.0.0.1:5432`.

## Files
- `pgbouncer.ini` — the live config (no secrets). Deploy to `/etc/pgbouncer/pgbouncer.ini`.
- `userlist.txt.example` — template for `/etc/pgbouncer/userlist.txt`. **Real SCRAM
  verifiers are NOT committed**; generate your own (see comments in the file).

## Key settings
| Setting | Value | Note |
|---|---|---|
| `listen_addr` / `listen_port` | `*` / `6432` | open to all interfaces |
| `auth_type` | `scram-sha-256` | verifiers in `userlist.txt` |
| `pool_mode` | `transaction` | server released after each txn |
| `max_client_conn` | `500` | total client connections |
| `default_pool_size` | `20` | server conns per user/db pair |
| `client_tls_sslmode` | `prefer` | TLS available; self-signed cert/key |

Backends (`[databases]`): `postgres`, `quantsaas` → `host=127.0.0.1 port=5432`.

## Deploy
```bash
cp pgbouncer.ini /etc/pgbouncer/pgbouncer.ini
cp userlist.txt.example /etc/pgbouncer/userlist.txt   # then edit in real verifier
chown postgres:postgres /etc/pgbouncer/pgbouncer.ini /etc/pgbouncer/userlist.txt
chmod 640 /etc/pgbouncer/pgbouncer.ini /etc/pgbouncer/userlist.txt
# TLS cert/key (self-signed example):
openssl req -new -x509 -days 3650 -nodes -out /etc/pgbouncer/pgbouncer.crt \
  -keyout /etc/pgbouncer/pgbouncer.key -subj "/CN=31.97.13.54"
chown postgres:postgres /etc/pgbouncer/pgbouncer.{crt,key}
chmod 640 /etc/pgbouncer/pgbouncer.crt; chmod 600 /etc/pgbouncer/pgbouncer.key
systemctl restart pgbouncer
```

> Note: TLS cert/key are intentionally not committed. The cloud-provider firewall
> must also allow inbound 6432 separately.
