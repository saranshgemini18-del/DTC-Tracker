# 🚌 DTC Real-Time Live Bus Radar

A transparent, zero-estimate public transit tracker for Delhi Transport Corporation (DTC) buses. Built to solve the "ghost bus" and inaccurate timetable issues found in standard transit apps by parsing Delhi Government's official Open Transit Data (OTD) GTFS-RT feed directly.

---

## ✨ Features

- **100% Real-Time Pings:** Uses raw GPS coordinates with zero fake scheduled interpolations.
- **Ghost Bus Filter:** Automatically drops stale GPS pings older than 180 seconds to ensure only active buses show up.
- **Dynamic Speed Calculation:** Computes actual vehicular speed based on distance and time delta between consecutive pings.
- **Next Stop & ETA Predictor:** Dynamically estimates the upcoming bus stop, distance, remaining minutes, and exact clock arrival time.
- **Auto Bus Stop Locator:** Scans user's live coordinates and highlights the nearest official Delhi bus stands with walking time estimates.
- **Search & Filter:** Instant search bar to filter by Route Number (e.g., `534`, `729`) or jump directly to a Bus Stop.
- **Smooth Glide Animations:** CSS coordinate transitions for realistic vehicle movements across map tiles.
- **Zero API Bill:** Powered by OpenStreetMap (Leaflet) and public transit endpoints.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express, WebSocket (`ws`), Axios
- **Feed Parser:** `gtfs-realtime-bindings` (Protocol Buffers)
- **Frontend:** Vanilla JavaScript, HTML5, CSS3, Leaflet.js, OpenStreetMap
- **Data Source:** Delhi Open Transit Data (OTD) Portal (`otd.delhi.gov.in`)

---

## 📁 Project Structure

```text
dtc-radar-app/
├── public/
│   └── index.html      # Leaflet map UI, WebSocket client, search & live radar
├── server.js           # GTFS-RT parser, speed/ETA engine, WebSocket broadcaster
├── package.json        # Dependencies & start scripts
└── README.md

🚀 Quick Start Guide
Prerequisites
Node.js (v16 or higher)
Delhi OTD Developer API Key
Installation & Run
1. Clone or Create the Project
