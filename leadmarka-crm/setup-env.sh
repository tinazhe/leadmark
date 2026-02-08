#!/bin/bash

echo "=========================================="
echo "LeadMarka Environment Setup Helper"
echo "=========================================="
echo ""
echo "This script will help you set up your .env file."
echo "You'll need your Supabase credentials from:"
echo "https://supabase.com/dashboard"
echo ""
echo "Press Enter to continue..."
read

echo ""
echo "Step 1: Supabase Project URL"
echo "Go to Project Settings > API"
echo "Copy the Project URL (looks like: https://xxxxx.supabase.co)"
echo ""
read -p "Enter Supabase URL: " SUPABASE_URL

echo ""
echo "Step 2: Supabase Service Role Key"
echo "In the same page, copy the 'service_role' key"
echo "(This is secret - never share it!)"
echo ""
read -s -p "Enter Service Role Key: " SUPABASE_SERVICE_KEY
echo ""

echo ""
echo "Step 3: Supabase Anon Key"
echo "Copy the 'anon' public key"
echo ""
read -p "Enter Anon Key: " SUPABASE_ANON_KEY

echo ""
echo "Step 4: Generate JWT Secret"
echo "Creating a secure random JWT secret..."
JWT_SECRET=$(openssl rand -base64 32)
echo "Generated!"

echo ""
echo "Step 5: Resend Email (Optional)"
echo "Sign up at https://resend.com for email notifications"
echo "Leave blank to skip for now"
echo ""
read -p "Enter Resend API Key (or press Enter to skip): " RESEND_API_KEY

if [ -z "$RESEND_API_KEY" ]; then
    RESEND_API_KEY="your-resend-api-key"
    FROM_EMAIL="info@update.leadmarka.co.zw"
else
    echo ""
    read -p "Enter From Email (e.g., info@update.leadmarka.co.zw): " FROM_EMAIL
fi

echo ""
echo "Step 6: Frontend URL"
echo "For local development: http://localhost:3000"
echo ""
read -p "Enter Frontend URL [http://localhost:3000]: " FRONTEND_URL
FRONTEND_URL=${FRONTEND_URL:-http://localhost:3000}

echo ""
echo "Creating .env file..."

cat > backend/.env << EOF
# Supabase Configuration
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# JWT Secret
JWT_SECRET=$JWT_SECRET

# Email Configuration (Resend)
RESEND_API_KEY=$RESEND_API_KEY
FROM_EMAIL=$FROM_EMAIL

# Server Configuration
PORT=3001
NODE_ENV=development

# Frontend URL (for password reset links)
FRONTEND_URL=$FRONTEND_URL
EOF

echo ""
echo "=========================================="
echo "✅ .env file created successfully!"
echo "=========================================="
echo ""
echo "Location: backend/.env"
echo ""
echo "Next steps:"
echo "1. cd backend"
echo "2. npm install"
echo "3. npm run dev"
echo ""
echo "Then in another terminal:"
echo "1. cd frontend"
echo "2. npm install"
echo "3. npm start"
echo ""
