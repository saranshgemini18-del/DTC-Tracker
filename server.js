const express = require('express');
const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const axios = require('axios');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const API_KEY = 'qj4xC9Up9YmsSAbfywNyD0vdpubZ09m9';
const OTD_RT_URL = `https://otd.delhi.gov.in/api/realtime/VehiclePositions.pb?key=${API_KEY}`;

app.use(express.static(path.join(__dirname, 'public')));

const httpsAgent = new https.Agent({ keepAlive: true, timeout: 45000 });

// Delhi Key Hubs & Stops
const delhiMasterStops = [
  { id: "DS1", name: "Kashmere Gate ISBT", lat: 28.6665, lng: 77.2285 },
  { id: "DS2", name: "Anand Vihar ISBT", lat: 28.6469, lng: 77.3160 },
  { id: "DS3", name: "Sarai Kale Khan ISBT", lat: 28.5912, lng: 77.2588 },
  { id: "DS4", name: "Shivaji Stadium Terminal", lat: 28.6297, lng: 77.2140 },
  { id: "DS5", name: "AIIMS Ring Road", lat: 28.5672, lng: 77.2100 },
  { id: "DS6", name: "Dhaula Kuan Flyover", lat: 28.5921, lng: 77.1616 },
  { id: "DS7", name: "Uttam Nagar Terminal", lat: 28.6219, lng: 77.0543 },
  { id: "DS8", name: "Nehru Place Bus Terminal", lat: 28.5492, lng: 77.2533 },
  { id: "DS9", name: "Azadpur Terminal", lat: 28.7076, lng: 77.1755 },
  { id: "DS10", name: "Badarpur Border Terminal", lat: 28.4988, lng: 77.3015 },
  { id: "DS11", name: "Saket Metro / Press Enclave", lat: 28.5204, lng: 77.2131 },
  { id: "DS12", name: "Lajpat Nagar Ring Road", lat: 28.5700, lng: 77.2374 },
  { id: "DS13", name: "Karol Bagh Metro", lat: 28.6445, lng: 77.1888 },
  { id: "DS14", name: "Janakpuri District Centre", lat: 28.6294, lng: 77.0778 },
  { id: "DS15", name: "Rohini Sector 22 Terminal", lat: 28.7231, lng: 77.0682 },
  { id: "DS16", name: "Mehrauli Terminal", lat: 28.5175, lng: 77.1856 },
  { id: "DS17", name: "Dwarka Sector 10 Metro", lat: 28.5813, lng: 77.0583 },
  { id: "DS18", name: "ITO Ring Road Bus Stand", lat: 28.6289, lng: 77.2415 },
  { id: "DS19", name: "Shadipur Depot", lat: 28.6517, lng: 77.1581 },
  { id: "DS20", name: "Mayur Vihar Phase 1 Pocket 1", lat: 28.6045, lng: 77.2946 },
  { id: "DS21", name: "Moti Nagar Metro Stand", lat: 28.6578, lng: 77.1425 },
  { id: "DS22", name: "Rajouri Garden Terminal", lat: 28.6489, lng: 77.1215 },
  { id: "DS23", name: "Punjabi Bagh Club", lat: 28.6685, lng: 77.1322 },
  { id: "DS24", name: "Tilak Nagar Terminal", lat: 28.6366, lng: 77.0964 },
  { id: "DS25", name: "Hauz Khas Metro Stop", lat: 28.5431, lng: 77.2065 },
  { id: "DS26", name: "Munirka Bus Stand", lat: 28.5576, lng: 77.1742 },
  { id: "DS27", name: "INA Colony / Dilli Haat", lat: 28.5744, lng: 77.2091 },
  { id: "DS28", name: "South Extension Ring Road", lat: 28.5714, lng: 77.2225 },
  { id: "DS29", name: "Moolchand Hospital Stand", lat: 28.5670, lng: 77.2340 },
  { id: "DS30", name: "Ashram Chowk Bus Stand", lat: 28.5711, lng: 77.2599 }
];

function getMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function findNextStopWithETA(busLat, busLng, currentSpeedKmh) {
  let closest = null;
  let minD = Infinity;

  delhiMasterStops.forEach(st => {
    const d = getMeters(busLat, busLng, st.lat, st.lng);
    if (d > 40 && d < minD) {
      minD = d;
      closest = st.name;
    }
  });

  if (!closest) {
    return { name: "Approaching Terminal", distance: 0, etaMinutes: 1, etaTime: "Arriving" };
  }

  const effectiveSpeed = currentSpeedKmh > 5 ? currentSpeedKmh : 18;
  const speedMps = (effectiveSpeed * 1000) / 3600;
  const secondsToReach = Math.round(minD / speedMps);
  const minutesToReach = Math.max(1, Math.round(secondsToReach / 60));

  const arrivalDate = new Date(Date.now() + secondsToReach * 1000);
  const etaTimeStr = arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return {
    name: closest,
    distance: Math.round(minD),
    etaMinutes: minutesToReach,
    etaTime: etaTimeStr
  };
}

app.get('/api/nearby-stops', async (req, res) => {
  const userLat = parseFloat(req.query.lat);
  const userLng = parseFloat(req.query.lng);

  if (isNaN(userLat) || isNaN(userLng)) return res.json(delhiMasterStops);

  const localNearby = delhiMasterStops
    .map(s => ({
      ...s,
      distance: Math.round(getMeters(userLat, userLng, s.lat, s.lng))
    }))
    .sort((a, b) => a.distance - b.distance);

  try {
    const query = `[out:json][timeout:4];node["highway"="bus_stop"](around:4000,${userLat},${userLng});out 30;`;
    const osmUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const osmRes = await axios.get(osmUrl, { timeout: 4500 });
    const elements = osmRes.data.elements || [];

    if (elements.length > 0) {
      const dynamicStops = elements
        .filter(el => el.lat && el.lon)
        .map(el => ({
          id: `osm_${el.id}`,
          name: (el.tags && (el.tags.name || el.tags['name:en'] || el.tags.local_ref)) || "DTC Bus Stop",
          lat: el.lat,
          lng: el.lon,
          distance: Math.round(getMeters(userLat, userLng, el.lat, el.lon))
        }))
        .sort((a, b) => a.distance - b.distance);

      return res.json(dynamicStops);
    }
  } catch (err) {}

  res.json(localNearby);
});

let liveBuses = [];
const busHistory = {};
let isFetching = false;

async function fetchLiveBuses() {
  if (isFetching) return;
  isFetching = true;

  try {
    const response = await axios.get(OTD_RT_URL, {
      responseType: 'arraybuffer',
      timeout: 25000,
      httpsAgent: httpsAgent,
      headers: { 'Accept-Encoding': 'gzip, deflate' }
    });

    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(response.data)
    );

    const now = Math.floor(Date.now() / 1000);
    const valid = [];

    feed.entity.forEach((e) => {
      if (e.vehicle && e.vehicle.position) {
        const v = e.vehicle;
        const busId = (v.vehicle && (v.vehicle.label || v.vehicle.id)) || e.id;
        const pingTime = v.timestamp ? (v.timestamp.low || v.timestamp) : now;
        const age = now - pingTime;

        if (age <= 180) {
          const lat = v.position.latitude;
          const lng = v.position.longitude;

          let routeNo = "DTC";
          if (v.trip) {
            if (v.trip.routeId) {
              routeNo = v.trip.routeId.replace(/_UP|_DN/gi, '');
            } else if (v.trip.tripId) {
              routeNo = v.trip.tripId.split('_')[0] || 'DTC';
            }
          }

          let calculatedSpeed = 0;
          if (busHistory[busId]) {
            const prev = busHistory[busId];
            const dist = getMeters(prev.lat, prev.lng, lat, lng);
            const timeDiff = Math.max(now - prev.time, 1);
            calculatedSpeed = Math.round((dist / timeDiff) * 3.6);
          }

          let finalSpeed = v.position.speed ? Math.round(v.position.speed * 3.6) : calculatedSpeed;
          if (finalSpeed > 80) finalSpeed = 38;

          busHistory[busId] = { lat, lng, time: now };

          const nextStopData = findNextStopWithETA(lat, lng, finalSpeed);

          valid.push({
            id: busId,
            route: routeNo,
            lat: lat,
            lng: lng,
            speed: finalSpeed,
            nextStop: nextStopData.name,
            distanceToNext: nextStopData.distance,
            etaMins: nextStopData.etaMinutes,
            etaTime: nextStopData.etaTime,
            age: age
          });
        }
      }
    });

    liveBuses = valid;
    const payload = JSON.stringify({ type: 'BUSES', count: liveBuses.length, buses: liveBuses });
    
    wss.clients.forEach(c => {
      if (c.readyState === WebSocket.OPEN) c.send(payload);
    });

  } catch (err) {
    console.log('[OTD Pulse Sync]', err.message);
  } finally {
    isFetching = false;
  }
}

setInterval(fetchLiveBuses, 15000);
fetchLiveBuses();

wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'BUSES', count: liveBuses.length, buses: liveBuses }));
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`DTC Next-Stop Radar active on Windows: http://localhost:${PORT}`);
});

