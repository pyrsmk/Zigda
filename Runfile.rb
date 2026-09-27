version 3

# Install dependencies
task :install do
  run "npm install"
end

# Start the app and API on http://localhost:5173
task :dev do
  run "npx vite dev"
end

# Build the app for production
task :build do
  run "npx vite build"
end

# Create the database tables
task :db_init do
  run "node scripts/init-db.js"
end
