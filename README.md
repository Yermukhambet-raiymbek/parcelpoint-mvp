# ParcelPoint — MVP prototype

Interactive MVP prototype for **ParcelPoint: a secure parcel pickup hub for university dormitories**, built for the CS-2430 Technological Entrepreneurship final project (Astana IT University, Bekzat Erkeshuly).

## What the prototype demonstrates

The full MVP loop of the product:

1. **Courier check-in** — one drop-off for the whole building; each parcel gets a unique ID and a one-time pickup code.
2. **Student notification** — the student receives a Telegram/SMS message with a one-time QR code.
3. **QR pickup** — the student scans the code at the hub; the hand-off is recorded in a timestamped audit log.

A seeded demo student is available: **room 214**, phone last 4 digits **0417** (both fields are pre-filled in the Student view).

## Run locally

Open `index.html` in any browser — no build step, no server, no backend. Data is stored in `localStorage` and can be restored with **Reset demo**.

## Scope

This is a product prototype, not production software: no backend, no authentication, no real Telegram/SMS gateway, no carrier API and no locker hardware integration. Those are explicitly outside the MVP scope described in the project report.

## Stack

Vanilla HTML/CSS/JavaScript. QR codes are generated client-side with [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT, Kazuhiko Arase), vendored in `qrcode.js`.
