# Free Deployment Guide

This guide details how to deploy your **Cold Email Automation** project for free using the best available services.

## Architecture Overview
- **Frontend**: Hosted on [Vercel](https://vercel.com) (Free Tier).
- **Backend**: Hosted on [Render](https://render.com) (Free Web Service).
- **Database**: Hosted on [Neon](https://neon.tech) (Free PostgreSQL).
- **Redis**: Hosted on [Upstash](https://upstash.com) (Free Redis).

---

## Step 1: Push Code to GitHub
Ensure you have pushed your latest code (including the changes I just made) to a GitHub repository.
```bash
git init
git add .
git update-index --chmod=+x backend/render-start.sh
git commit -m "Prepare for deployment"
# Replace <YOUR_REPO_URL> with your actual GitHub repository URL
git remote add origin <YOUR_REPO_URL>
git push -u origin main
```

---

## Step 2: Set up Database (Neon)
1. Go to [Neon.tech](https://neon.tech) and sign up.
2. Create a new project (e.g., `cold-email-db`).
3. Copy the **Connection String** from the dashboard.
   - It will look like: `postgresql://user:password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require`
   - **Important**: Ensure it starts with `postgresql://` (not `postgres://`). If it is `postgres://`, just manually change it to `postgresql://` for compatibility.

---

## Step 3: Set up Redis (Upstash)
1. Go to [Upstash.com](https://upstash.com) and sign up.
2. Create a new Redis database.
3. Scroll down to the "Connect" section and copy the **Redis URL**.
   - It will look like: `redis://default:password@fly-xyz.upstash.io:6379`

---

## Step 4: Deploy Backend (Render)
1. Go to [Render.com](https://render.com) and sign up.
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Configure the service:
   - **Name**: `cold-email-backend`
   - **Root Directory**: `backend` (Important!)
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Scroll down to **Environment Variables** and add:
   - `DATABASE_URL`: (Paste your Neon Connection String)
   - `REDIS_URL`: (Paste your Upstash Redis URL)
   - `PYTHON_VERSION`: `3.10.0`
6. Click **Create Web Service**.
7. Wait for the deployment to finish. Once live, copy your backend URL (e.g., `https://cold-email-backend.onrender.com`).

---

## Step 5: Deploy Frontend (Vercel)
1. Go to [Vercel.com](https://vercel.com) and sign up.
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository.
4. Configure the project:
   - **Framework Preset**: Vite (Automatic)
   - **Root Directory**: Click "Edit" and select `frontend`.
5. Open **Environment Variables**:
   - Key: `VITE_API_URL`
   - Value: (Paste your backend URL)
6. Click **Deploy**.

---

## Alternative: Deploy Backend on Koyeb (Free Tier)
If you prefer not to use Render, **Koyeb** is an excellent alternative:
1. Sign up at [Koyeb.com](https://www.koyeb.com).
2. Create **App** -> **Web Service**.
3. Select **GitHub** as the source and connect your repo.
4. Set **Builder** to **Dockerfile** (this will use the `backend/Dockerfile` we updated).
5. Set **Environment Variables** (`DATABASE_URL`, `REDIS_URL`).
6. Deploy. Koyeb is often faster to wake up than Render.

## Alternative: Deploy on a Virtual Machine (AWS, Google Cloud, Oracle)
For full control, you can use a free tier VM (e.g., AWS EC2 t2.micro).
This requires manual setup:
1. SSH into the server.
2. Install Docker & Docker Compose.
3. Clone your repo.
4. Create a `.env` file with your database content.
5. Run `docker-compose up -d --build`.


---

## Step 6: Finalize
1. Your frontend is now live on a Vercel URL (e.g., `https://your-app.vercel.app`).
2. Open it and test logging in. The backend might take a minute to spin up on the free tier (cold starts), so be patient on the first request.
