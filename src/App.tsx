import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useParams,
  useNavigate,
} from "react-router-dom";

// Small helper: format elapsed milliseconds to HH:MM:SS (hours can be >24)
function formatElapsed(ms: number) {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function useNow(tickMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  return now;
}

// GMList component
function GMList() {
  const [players, setPlayers] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("https://api.chess.com/pub/titled/GM")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data.players)) setPlayers(data.players);
        else setError("Unexpected API response");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!players) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => p.toLowerCase().includes(q));
  }, [players, filter]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Chess Grandmasters (GM)</h1>
      <p>
        Data from chess.com public API — <code>/pub/titled/GM</code>
      </p>
      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Filter by username"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ padding: 8, width: 240 }}
        />
      </div>

      {loading && <div>Loading...</div>}
      {error && (
        <div style={{ color: "red" }}>
          Error loading players: {error}
        </div>
      )}

      {!loading && players && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {filtered.map((username) => (
            <li
              key={username}
              style={{
                padding: 8,
                borderBottom: "1px solid #eee",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Link to={`/player/${encodeURIComponent(username)}`}>{username}</Link>
              <Link to={`/player/${encodeURIComponent(username)}`}>View</Link>
            </li>
          ))}
        </ul>
      )}

      {!loading && players && players.length === 0 && <div>No players found.</div>}
    </div>
  );
}

// GMProfile component
function GMProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // keep `now` ticking every second so we can compute elapsed since last_online
  const now = useNow(1000);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  const lastOnlineMs = useMemo(() => {
    if (!data || !data.last_online) return null;
    // chess.com returns seconds since epoch
    return data.last_online * 1000;
  }, [data]);

  const elapsed = useMemo(() => {
    if (lastOnlineMs === null) return null;
    return now - lastOnlineMs;
  }, [now, lastOnlineMs]);

  return (
    <div style={{ padding: 20 }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: 12 }}>
        ← Back
      </button>

      {loading && <div>Loading profile...</div>}
      {error && <div style={{ color: "red" }}>Error: {error}</div>}

      {data && (
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ minWidth: 200 }}>
            {data.avatar ? (
              <img src={data.avatar} alt="avatar" style={{ width: 180 }} />
            ) : (
              <div
                style={{
                  width: 180,
                  height: 180,
                  background: "#f0f0f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                No avatar
              </div>
            )}

            <div style={{ marginTop: 8 }}>
              <a href={data.url} target="_blank" rel="noreferrer">
                View on chess.com
              </a>
            </div>
          </div>

          <div>
            <h2>
              {data.name || data.username} {data.title ? `(${data.title})` : ""}
            </h2>
            <div style={{ marginBottom: 8 }}>
              <strong>Username:</strong> {data.username}
            </div>
            {data.country && (
              <div style={{ marginBottom: 8 }}>
                <strong>Country:</strong>{" "}
                <a href={data.country} target="_blank" rel="noreferrer">
                  {data.country}
                </a>
              </div>
            )}
            {data.joined && (
              <div style={{ marginBottom: 8 }}>
                <strong>Joined:</strong>{" "}
                {new Date(data.joined * 1000).toLocaleDateString()}
              </div>
            )}
            {data.followers !== undefined && (
              <div style={{ marginBottom: 8 }}>
                <strong>Followers:</strong> {data.followers}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <h3>Last online</h3>
              {lastOnlineMs === null ? (
                <div>No last_online data available</div>
              ) : (
                <div>
                  <div>Last seen at: {new Date(lastOnlineMs).toLocaleString()}</div>
                  <div style={{ fontFamily: "monospace", marginTop: 8 }}>
                    Time since last online: {formatElapsed(elapsed ?? 0)} (HH:MM:SS)
                  </div>
                </div>
              )}
            </div>

            {data.badges && data.badges.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4>Badges</h4>
                <ul>
                  {data.badges.map((b: any) => (
                    <li key={b.name}>{b.name}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Debug: show raw JSON (comment out in production) */}
            <details style={{ marginTop: 16 }}>
              <summary>Raw profile JSON</summary>
              <pre style={{ maxHeight: 300, overflow: "auto" }}>
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}

// App root
export default function App() {
  return (
    <BrowserRouter>
      <div style={{ fontFamily: "system-ui, Arial, sans-serif" }}>
        <nav style={{ padding: 12, borderBottom: "1px solid #ddd" }}>
          <Link to="/">Home</Link>
        </nav>
        <Routes>
          <Route path="/" element={<GMList />} />
          <Route path="/player/:username" element={<GMProfile />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
