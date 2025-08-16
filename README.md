# VideoPro Portfolio

Run locally:

1. Copy environment file and edit values

```
cp .env.example .env
```

2. Install dependencies

```
npm install
```

3. Start the server

```
npm run dev
```

4. Open http://localhost:3000

By default `EMAIL_DRY_RUN=true` so form submits will succeed without sending real emails. To enable sending, set your SMTP vars in `.env` and set `EMAIL_DRY_RUN=false`.