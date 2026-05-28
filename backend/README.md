# Step-by-Step Setup Guide (Without Docker)

## Prerequisites for Windows:
- PHP 8.2+ (Make sure the pgsql, pdo_pgsql, and mbstring extensions are enabled in php.ini).
- Composer installed globally.
- Node.js (v18 or v20) and NPM.
- PostgreSQL installed natively and running (default port 5432).
- Step 1: Clone the Repository
- Open Git Bash or PowerShell and clone the project:

bash
git clone <your-repository-url>
cd SmartKiosk-Project/smartkiosk
Step 2: Backend Setup (Laravel)
Open a terminal in the smartkiosk/backend folder:

bash
cd backend
# Install PHP dependencies
composer install
# Set up environment variables
copy .env.example .env
# Generate application key
php artisan key:generate
Database Configuration: Open the newly created backend/.env file and update the database credentials to match their local Windows PostgreSQL installation:

env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=smartkiosk
DB_USERNAME=postgres  # usually postgres on Windows
DB_PASSWORD=their_password
(If they don't have Redis installed, make sure they set CACHE_STORE=database, QUEUE_CONNECTION=database, and SESSION_DRIVER=database just like we did!)

Run Migrations and Seed the Database:

bash
php artisan migrate --seed
Step 3: Frontend Setup (Next.js)
Open a new terminal in the smartkiosk/frontend folder:

bash
cd frontend
# Set up environment variables
copy .env.local.example .env.local
# Install Node dependencies
npm install
Step 4: Run the Application
They will need two terminal windows open simultaneously:

Terminal 1 (Backend):

bash
cd backend
php artisan serve
Terminal 2 (Frontend):

bash
cd frontend
npm run dev