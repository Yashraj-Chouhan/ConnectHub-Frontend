


## Local development

Run from the `frontend` folder:

```powershell
npm install
npm run dev
```

When the app is opened on `localhost` or a private LAN IP, it automatically
talks to the backend gateway on the same host at port `8080`.

- `http://localhost:5173` -> `http://localhost:8080`
- `http://192.168.x.x:5173` -> `http://192.168.x.x:8080`

If you explicitly want the Vite `/api` proxy path in development, set:

```env
VITE_USE_DEV_PROXY=true
```

## Docker deployment

The frontend has its own Docker setup and is deployed separately from the backend.

Files:

- [Dockerfile](/C:/Users/yashr/Desktop/Projects/ConnectHub/frontend/Dockerfile)
- [docker-compose.yml](/C:/Users/yashr/Desktop/Projects/ConnectHub/frontend/docker-compose.yml)
- [deploy/ec2/README.md](/C:/Users/yashr/Desktop/Projects/ConnectHub/frontend/deploy/ec2/README.md)

## EC2 HTTP deployment

Create a `.env` file in `frontend` from `.env.example` and set:

```env
VITE_API_BASE_URL=http://<ec2-public-ip>:8080
VITE_GOOGLE_CLIENT_ID=your_google_web_client_id.apps.googleusercontent.com
FRONTEND_PUBLIC_PORT=80
```

`VITE_API_BASE_URL` is only needed for the split-origin EC2 deployment where
the frontend is served on port `80` and the backend gateway stays on `8080`.
The same codebase still uses the local gateway automatically when opened on
`localhost` during development.

Then run from the `frontend` folder:

```powershell
docker compose up --build -d
```

Open:

- `http://<ec2-public-ip>`
