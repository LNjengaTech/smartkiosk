# Filament Admin Panel: Installation & Usage Guide

This guide details how to install, configure, and automatically generate a browser-based database dashboard for your Laravel Eloquent models using Filament v3.

---

## Step 1: Installation & Setup

Run the following commands in order to install the core Filament packages and create your administrative panel.

### 1. Install Core Packages
Pull in the Filament panel builder package with its required dependencies:
```bash
composer require filament/filament:"^3.0" -W
```

### 2. Install the Panel Layout
Generate the default Filament panel structure configuration inside your application:
```bash
php artisan filament:install --panels
```
*This creates the configuration files and registers the `AdminPanelProvider` inside your app.*

### 3. Create an Administrative User
Create your first credentials to log into the web interface:
```bash
php artisan make:filament-user
```
*Follow the terminal prompts to enter a Name, Email Address, and Password.*

---

## Step 2: Bulk Resource Generation

Instead of creating visual panels one by one, use this automation script to scan your `app/Models` directory. It reads your database tables and automatically builds forms, tables, and CRUD operations for **all** models simultaneously.

```bash
for model in $(ls app/Models/*.php | awk -F/ '{print $NF}' | sed 's/\.php//'); do php artisan make:filament-resource $model --generate; done
```

### What This Command Does:
*   **Scans** your `app/Models/` folder.
*   **Extracts** every model name (e.g., `Category`, `Product`, `User`).
*   **Executes** the generator with the `--generate` flag, which automatically inspects your PostgreSQL database schema to design the UI components for you.

---

## Step 3: Access & Usage

### 1. Accessing the Dashboard
Start your local development server if it is not already running:
```bash
php artisan serve
```
Open your browser and navigate to:
```text
http://localhost:8000/admin
```
*(If you are using Laravel Sail or a custom domain, replace `localhost:8000` with your local development URL).*

### 2. Logging In
Log in using the email and password you created in **Step 1.3**.

### 3. Managing Data
*   **Sidebar Navigation**: All your generated models will appear as individual tabs on the left sidebar.
*   **CRUD Operations**: Click on any resource (like `Categories`) to instantly View, Search, Filter, Create, Edit, or Delete records in your database using Eloquent under the hood.

---

## Ongoing Maintenance

When you add **new Eloquent models** to your application later down the line, you do not need to re-run the whole loop. Simply generate a dashboard resource for that specific new model using:

```bash
php artisan make:filament-resource ModelName --generate
```
