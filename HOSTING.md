# Hosting Tronex on shared web hosting (PHP + MySQL)

This project now runs on **PHP 8.1+** and **MySQL** — suitable for cPanel, Plesk, and similar hosts (no Node.js required).

## Requirements

- PHP 8.1 or newer with extensions: `pdo_mysql`, `json`, `mbstring`, `gd` (for image resize/WebP)
- MySQL 5.7+ or MariaDB 10.3+
- Apache with `mod_rewrite` (or equivalent URL rewriting)
- Composer (on your computer or via SSH on the host)

## Setup steps

### 1. Upload files

Upload the whole project to your account (e.g. `public_html/` or a subdomain folder). The document root should be the folder that contains `index.php` and `.htaccess`.

Typical layout:

```
public_html/
  index.php
  .htaccess
  includes/
  views/
  public/          ← CSS, JS, images, uploads
  vendor/          ← after composer install
  .env
```

### 2. Create MySQL database

In cPanel → **MySQL Databases**:

1. Create a database (e.g. `username_tronex`)
2. Create a user with a strong password
3. Add the user to the database with **ALL PRIVILEGES**
4. Open **phpMyAdmin** → select the database → **Import** → choose `database/schema.sql`

### 3. Configure environment

Copy `.env.example` to `.env` and set:

- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`
- `JWT_SECRET` — long random string (32+ characters)
- `ADMIN_PASSWORD` — password for `/admin-login`
- `EMAIL_FROM` and SMTP settings (for proforma invoice emails)

### 4. Install PHP dependencies

On your PC (with [Composer](https://getcomposer.org/) installed):

```bash
cd tronex-importation-website
composer install --no-dev
```

Upload the generated `vendor/` folder to the server.

If your host provides SSH:

```bash
cd ~/public_html
composer install --no-dev
```

### 5. Folder permissions

Ensure these are writable by the web server (often `755` for folders, `644` for files; some hosts need `775` on upload dirs):

- `public/uploads/cars/`
- `public/uploads/customers/`

### 6. Test the site

- Home: `https://yourdomain.com/`
- Admin: `https://yourdomain.com/admin-login`
- Add a car in **Manage Cars** after logging in as admin

## Migrating data from MongoDB

If you had cars and users in the old Node/MongoDB version, export them as JSON and import manually into MySQL, or ask for a one-time migration script. New installs start with an empty database (stock numbers begin at `TRON26-00200` after the first car).

## API compatibility

The frontend still calls the same URLs (`/api/cars`, `/api/auth/login`, etc.). Car IDs are now numeric MySQL IDs (exposed as `_id` in JSON, e.g. `"5"`), so links look like `/car/5` instead of MongoDB ObjectIds.

## Troubleshooting

| Problem | Fix |
|--------|-----|
| 404 on all pages except home | Enable **mod_rewrite**; confirm `.htaccess` is uploaded |
| 500 on API calls | Check `.env` database credentials; verify `vendor/` exists |
| Images not uploading | Check `public/uploads` permissions and PHP `upload_max_filesize` |
| Admin login fails | Set `ADMIN_PASSWORD` in `.env` |
| Invoice email fails | Configure SMTP in `.env` (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`) |

## Old Node.js version

The previous stack (`server.js`, `package.json`, MongoDB) is no longer required for production. You can keep those files for reference or remove them after you confirm PHP hosting works.
