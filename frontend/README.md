# Smart Cargo Monitoring Frontend

React + Vite dashboard for Smart Cargo Monitoring.

## Stack

- React
- Vite
- axios
- react-leaflet
- leaflet
- recharts

## Features

- Dashboard page with live status cards
- Polls backend every 5 seconds:
  - GET /api/latest
  - GET /api/alerts
- Shows:
  - current temperature, humidity, pressure, gas
  - shock status
  - online/offline badge
  - alert panel
  - map marker from GPS lat/lon
- Supports one truck/container cleanly with selector-ready structure for multiple devices later
- Chart is shown only when backend history is available; otherwise cards-only view

## Environment

Create .env file from .env.example:

- VITE_API_URL=https://vish85521-cargo.hf.space/api

## Run

1. Install dependencies

   npm install

2. Start development server

   npm run dev

3. Build production bundle

   npm run build

4. Preview production build

   npm run preview
