import http from "k6/http";
import ws from "k6/ws";
import crypto from "k6/crypto";
import encoding from "k6/encoding";
import exec from "k6/execution";
import { check, fail } from "k6";
import { Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001";
const WS_URL = __ENV.WS_URL || "ws://localhost:4000";
const JWT_SECRET = __ENV.JWT_SECRET || "loadtest-local-secret";
const SHOW_ID = "EVT-001#2025-04-01#19:00";

const USERS = 1000;
const RATE = Number(__ENV.RATE || 500); // hold requests per second
const WATCHERS = 50;
const SEATS = [];
for (const row of "ABCDEFGHIJ")
  for (let i = 1; i <= 10; i++) SEATS.push(`${row}${i}`);

const holdsOk = new Counter("holds_ok");
const holdsConflict = new Counter("holds_conflict");
const holdsUnexpected = new Counter("holds_unexpected");
const wsSeatUpdates = new Counter("ws_seat_updates");

export const options = {
  scenarios: {
    watchers: {
      executor: "per-vu-iterations",
      exec: "watch",
      vus: WATCHERS,
      iterations: 1,
      maxDuration: "30s",
    },
    stampede: {
      executor: "constant-arrival-rate",
      exec: "hold",
      rate: RATE,
      timeUnit: "1s",
      duration: `${USERS / RATE}s`,
      preAllocatedVUs: 300,
      maxVUs: USERS,
      startTime: "3s",
    },
  },
  thresholds: {
    holds_ok: ["count==100"],
    holds_conflict: ["count==900"],
    holds_unexpected: ["count==0"],
    ws_seat_updates: [`count==${WATCHERS * 100}`],
    "http_req_duration{scenario:stampede}": ["p(95)<1000"],
  },
};

function signJwt(sub) {
  const b64 = (obj) => encoding.b64encode(JSON.stringify(obj), "rawurl");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub,
    email: `${sub}@loadtest.local`,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const signature = crypto.hmac(
    "sha256",
    JWT_SECRET,
    `${header}.${payload}`,
    "base64rawurl",
  );
  return `${header}.${payload}.${signature}`;
}

export function setup() {
  const free = seatMap().filter((s) => s.status === "AVAILABLE").length;
  if (free !== SEATS.length)
    fail(
      `only ${free}/${SEATS.length} seats free — wait 60s for holds to expire`,
    );
}

export function hold() {
  const i = exec.scenario.iterationInTest;
  if (i >= USERS) return;
  const user = `loadtest-user-${i}`;
  const seat = SEATS[Math.floor(i / (USERS / SEATS.length)) % SEATS.length];

  const res = http.post(
    `${BASE_URL}/api/bookings/hold`,
    JSON.stringify({ show_id: SHOW_ID, seat_id: seat }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${signJwt(user)}`,
      },
      responseCallback: http.expectedStatuses(200, 409),
    },
  );

  if (res.status === 200) holdsOk.add(1);
  else if (res.status === 409) holdsConflict.add(1);
  else {
    holdsUnexpected.add(1);
    console.error(`unexpected ${res.status} for ${seat}: ${res.body}`);
  }
  check(res, {
    "hold is 200 or 409": (r) => r.status === 200 || r.status === 409,
  });
}

export function watch() {
  const url = `${WS_URL}?token=${signJwt(`loadtest-watcher-${__VU}`)}`;
  ws.connect(url, {}, (socket) => {
    socket.on("open", () =>
      socket.send(
        JSON.stringify({ action: "subscribe", channel: `show:${SHOW_ID}` }),
      ),
    );
    socket.on("message", (raw) => {
      const msg = JSON.parse(raw);
      if (msg.status === "HELD") wsSeatUpdates.add(1);
    });
    socket.setTimeout(() => socket.close(), 15000);
  });
}

function seatMap() {
  const res = http.get(
    `${BASE_URL}/api/bookings/seat-map/${encodeURIComponent(SHOW_ID)}`,
    {
      headers: { Authorization: `Bearer ${signJwt("loadtest-auditor")}` },
    },
  );
  return res.json("rows").flatMap((r) => r.seats);
}

export function teardown() {
  const seats = seatMap();
  const held = seats.filter((s) => s.status === "HELD").length;
  console.log(`seat map after run: ${held}/${seats.length} seats HELD`);
  check(held, { "all 100 seats held exactly once": (n) => n === 100 });
}
