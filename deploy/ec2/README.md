# Frontend EC2 Deployment

Use this when the backend is already running separately and exposed through:

- `http://<ec2-public-ip>:8080`

## Required `.env` values

Create a `.env` file in the `frontend` folder from `.env.example` and set:

```env
VITE_API_BASE_URL=http://<ec2-public-ip>:8080
VITE_GOOGLE_CLIENT_ID=your_google_web_client_id.apps.googleusercontent.com
FRONTEND_PUBLIC_PORT=80
PING_MESSAGE=ping
```

This deployment value does not break local development. When the same frontend
code is opened on `localhost` or a private LAN IP, it automatically switches
back to the local backend gateway on port `8080`.

Example:

```env
VITE_API_BASE_URL=http://16.170.18.188:8080
VITE_GOOGLE_CLIENT_ID=524012515071-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
FRONTEND_PUBLIC_PORT=80
PING_MESSAGE=ping
```

## Start command

Run this from the `frontend` folder on EC2:

```powershell
docker compose up --build -d
```

## URL

Open:

- `http://<ec2-public-ip>`

## Google login note

If you use Google sign-in, add this to Google OAuth authorized JavaScript origins:

- `http://<ec2-public-ip>`
