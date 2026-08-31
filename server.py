import os
import pg8000.native
from urllib.parse import urlparse

DATABASE_URL = os.environ.get("DATABASE_URL")

def init_db():
    if not DATABASE_URL:
        print("⚠️ DATABASE_URL environment variable is missing!")
        return
    try:
        url = urlparse(DATABASE_URL)
        con = pg8000.native.Connection(
            user=url.username,
            password=url.password,
            host=url.hostname,
            port=url.port or 5432,
            database=url.path.lstrip('/') or 'postgres',
            ssl_context=True
        )
        con.run("""
            CREATE TABLE IF NOT EXISTS users (
                telegram_id BIGINT PRIMARY KEY,
                username VARCHAR(100),
                balance NUMERIC(10, 2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        con.close()
        print("🐘 PostgreSQL connected successfully via pg8000!")
    except Exception as e:
        print(f"❌ Database error: {e}")

init_db()
