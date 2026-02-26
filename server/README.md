# Nail Shop Backend

## What this provides
- Appointment booking API
- Admin login (JWT)
- Admin view/confirm/delete bookings
- SMS inbox + replies via Twilio
- Email notifications via Resend

## Local setup
1. `cd server`
2. Create `.env` and fill in env values
3. `npm install`
4. `npm run dev`

## Optional env
- `DEFAULT_APPOINTMENT_MINUTES` (default `60`)
- `ADMIN_2FA_ENABLED` (`true` to require OTP, default `false` for direct admin login)

## Twilio env
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER` (your Twilio SMS number in E.164 format)
- `TWILIO_WEBHOOK_BASE_URL` (public backend URL used for webhook signature validation, e.g. `https://api.example.com`)

## API routes
- `POST /api/bookings`
- `POST /api/admin/login/init`
- `POST /api/admin/login/verify`
- `GET /api/admin/bookings`
- `POST /api/admin/bookings/:id/confirm`
- `DELETE /api/admin/bookings/:id`
- `POST /api/twilio/webhook`
- `GET /api/admin/messages/groups`
- `GET /api/admin/messages/:phone`
- `POST /api/admin/messages/:phone/reply`
- `GET /api/health`

## Twilio webhook setup
- In Twilio Console, set your Messaging webhook URL to: `https://<your-backend-domain>/api/twilio/webhook`
- Method: `POST`
- Twilio will post incoming SMS to this endpoint.

## Render deployment (default target)
1. Create a new Web Service from the `server` folder.
2. Use MongoDB Atlas for the database and set `MONGODB_URI`.
3. Set env vars from `.env.example` plus the Twilio vars above.
4. Set `CLIENT_ORIGIN` to your frontend URL.
