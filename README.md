


## Local development

Run from the `frontend` folder:

```powershell
npm install
npm run dev
```

By default the app talks to `http://localhost:8080` for backend requests.

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

Then run from the `frontend` folder:

```powershell
docker compose up --build -d
```

Open:

- `http://<ec2-public-ip>`
