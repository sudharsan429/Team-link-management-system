import os
import getpass
import psycopg2
from werkzeug.security import generate_password_hash
from dotenv import load_dotenv

load_dotenv()

username = os.getenv("ADMIN_USERNAME", "abisiva")
new_password = getpass.getpass("Enter your new admin password: ")

if not new_password:
    raise SystemExit("Password cannot be empty.")

with psycopg2.connect(
    os.getenv("DATABASE_URL"),
    sslmode=os.getenv("DB_SSLMODE", "prefer")
) as conn:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE tlms_users
            SET password_hash = %s
            WHERE LOWER(username) = LOWER(%s)
              AND role = 'admin'
              AND active = TRUE
            """,
            (generate_password_hash(new_password), username)
        )
        if cur.rowcount != 1:
            raise SystemExit("Admin account not found. Check username.")
        print("Admin password reset successful!")