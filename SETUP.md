# TLMS — Flask + PostgreSQL setup (Windows / VS Code)

This package contains your existing frontend with a Flask backend starter and PostgreSQL persistence. Your HTML/CSS design is retained. The browser-side data layer is synchronized to the Flask API when changes are saved. Passwords are hashed on the server.

## 1. Install PostgreSQL
If PostgreSQL is not installed, install PostgreSQL for Windows from https://www.postgresql.org/download/windows/ . Remember the password you choose for the `postgres` database user. pgAdmin is useful but optional.

## 2. Create the database
Open pgAdmin, connect to your local server, right-click Databases → Create → Database, and name it `tlms`. Or use SQL: `CREATE DATABASE tlms;`

## 3. Open the project in VS Code
Extract this ZIP. In VS Code, open the `TLMS_Full_Project` folder. Open Terminal → New Terminal.

## 4. Create a virtual environment and install packages
Run these commands in PowerShell from the project folder:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If PowerShell blocks activation, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`, then activate again.

## 5. Configure `.env`
Copy `.env.example` to a new file named `.env`. Edit `DATABASE_URL` and replace `YOUR_POSTGRES_PASSWORD` with your PostgreSQL password. Choose a strong `FLASK_SECRET_KEY` and change the default admin password before using real data. Do not share or commit `.env`.

Example (replace the password):
`DATABASE_URL=postgresql://postgres:MyDatabasePassword@localhost:5432/tlms`

## 6. Run the app
```powershell
python app.py
```
Open http://127.0.0.1:5000 . The database tables are created automatically on first request. You can check the database connection at http://127.0.0.1:5000/health .

## Initial admin login
The first run creates the admin using `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env`. The example values are only for local setup; change them first. If you change these values after the admin user has already been created, the existing database account will not automatically change.

## Notes / current integration scope
- Login is verified on the Flask server; protected admin/employee pages require a server session.
- PostgreSQL stores the application state and employee login hashes. Employee passwords are not returned from the server.
- Existing UI interactions use a local browser cache and save changes to the server API. Since this frontend was originally designed around synchronous localStorage, test every feature carefully and report any browser-console/API errors.
- The current state API is a starter integration, not a production multi-user concurrency design. Employee-specific authorization for every data operation and fine-grained team scoping should be completed before public deployment.
- External Font Awesome CDN is used by the original UI, so icons require internet access.
