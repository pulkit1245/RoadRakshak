import React, { useRef, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { websocketAPI, getWebSocketUrl, olaMapsAPI } from '../services/api';

/** Send interval in ms (~1000/this ≈ max send FPS). Backend still runs full CV every 4th frame. */
const LIVE_FEED_FRAME_INTERVAL_MS = 50;

export default function LiveFeed() {
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const frameIntervalRef = useRef(null);
  const captureCanvasRef = useRef(null);

  const [isRunning, setIsRunning] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [detections, setDetections] = useState([]);
  const [fps, setFps] = useState(0);
  const [latestDetection, setLatestDetection] = useState(null);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [wsDebug, setWsDebug] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const geoWatchIdRef = useRef(null);
  const userLocationRef = useRef(null);

  // Accident history — running log for this session
  const [accidentHistory, setAccidentHistory] = useState([]);
  const lastAccidentIdRef = useRef(null);

  // Ola Maps: top-5 hospitals nearest to latest accident
  const [olaHospitals, setOlaHospitals] = useState([]);

  const startStream = () => {
    setIsRunning(true);
    setFrameCount(0);
    setDetections([]);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({ lat: position.coords.latitude, lon: position.coords.longitude });
        },
        () => setUserLocation(null),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 8000 }
      );
    }
    connectWebSocket();
  };

  const stopStream = () => {
    setIsRunning(false);
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    if (wsRef.current) websocketAPI.disconnect(wsRef.current);
    if (geoWatchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(geoWatchIdRef.current);
      geoWatchIdRef.current = null;
    }
  };

  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);

  const connectWebSocket = () => {
    const targetUrl = getWebSocketUrl();
    setWsDebug({ phase: 'connecting', url: targetUrl, at: new Date().toISOString() });

    wsRef.current = websocketAPI.connectDetectionStream({
      onOpen: () => {
        setConnectionStatus('connected');
        setError('');
        setWsDebug({ phase: 'open', url: targetUrl, at: new Date().toISOString() });
        startFrameCapture();
      },
      onMessage: (data) => {
        if (data.error) setError(String(data.error));
        setLatestDetection(data);

        // Append accident to history (deduplicate by incident id)
        if (data.accident) {
          const incidentId = data.id;
          if (incidentId !== lastAccidentIdRef.current || incidentId === null) {
            lastAccidentIdRef.current = incidentId;

            // Play siren sound 
            try { 
              const audioEl = document.getElementById('siren-audio');
              if (audioEl) {
                audioEl.currentTime = 0;
                audioEl.play().catch(e => console.error("Audio play blocked by browser:", e));
              }
            } catch (e) { console.error(e); }

            // Coordinates for Ola Maps lookup
            const accLat = data.emergency?.accident_lat ?? userLocationRef.current?.lat ?? null;
            const accLon = data.emergency?.accident_lon ?? userLocationRef.current?.lon ?? null;

            // Non-blocking Ola Maps request
            const olaFetch = (accLat != null && accLon != null)
              ? olaMapsAPI.getNearbyHospitals(accLat, accLon)
              : Promise.resolve([]);

            olaFetch.then((hospitals) => {
              setOlaHospitals(hospitals);

              // Set history immediately (dispatchResult will be patched in below)
              const historyEntry = {
                id: incidentId,
                timestamp: new Date().toISOString(),
                severity: data.severity || 'unknown',
                location: data.location || 'Unknown',
                violations: data.violations || [],
                emergency: data.emergency || null,
                vehicles: data.vehicles || 0,
                olaHospitals: hospitals,
                accidentLat: accLat,
                accidentLon: accLon,
                dispatchResult: null,
              };

              setAccidentHistory((prev) =>
                [historyEntry, ...prev].slice(0, 50)
              );

              // Auto-dispatch the #1 nearest Ola hospital to the backend
              if (hospitals.length > 0) {
                olaMapsAPI.dispatchOlaHospital({
                  incidentId: incidentId,
                  severity: data.severity || 'high',
                  location: data.location || 'unknown',
                  vehicles: data.vehicles || 0,
                  hospital: hospitals[0],
                  accidentLat: accLat,
                  accidentLon: accLon,
                }).then((result) => {
                  if (result) {
                    // Patch the dispatch result into the existing history entry
                    setAccidentHistory((prev) =>
                      prev.map((entry) =>
                        entry.id === incidentId && entry.timestamp === historyEntry.timestamp
                          ? { ...entry, dispatchResult: result }
                          : entry
                      )
                    );
                  }
                });
              }
            });
          }
        }

        if (data.vehicles && Array.isArray(data.vehicles)) setDetections(data.vehicles);
      },
      onError: (payload) => {
        setConnectionStatus('error');
        setError('WebSocket error. Check: backend running; same port as VITE_API_URL.');
        setWsDebug((d) => ({ ...d, phase: 'error', at: new Date().toISOString(), payload }));
      },
      onClose: (event, detail) => {
        setConnectionStatus('disconnected');
        setWsDebug({
          phase: 'close', at: new Date().toISOString(),
          code: detail?.code, reason: detail?.reason,
          wasClean: detail?.wasClean, meaning: detail?.meaning, url: detail?.url,
        });
        if (detail && (detail.code === 1006 || detail.code === 1002)) {
          setError(`WebSocket failed (${detail.code}): ${detail.meaning}. URL: ${detail.url}`);
        }
      },
    });
  };

  const startFrameCapture = () => {
    if (!captureCanvasRef.current) captureCanvasRef.current = document.createElement('canvas');
    const captureCanvas = captureCanvasRef.current;
    let framesSent = 0;
    const startTime = Date.now();

    frameIntervalRef.current = setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const video = webcamRef.current?.video;
      if (!video || video.videoWidth === 0) return;

      try {
        const ctx = captureCanvas.getContext('2d');
        captureCanvas.width = video.videoWidth;
        captureCanvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const frame = captureCanvas.toDataURL('image/jpeg', 0.72);
        const loc = userLocationRef.current;
        const meta = loc
          ? { latitude: loc.lat, longitude: loc.lon, location: `${loc.lat},${loc.lon}` }
          : { latitude: 28.6, longitude: 77.2, location: '28.6,77.2' };
        websocketAPI.sendFrame(ws, frame, meta);
        framesSent++;
        setFrameCount(framesSent);
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed > 0) setFps(Math.round(framesSent / elapsed));
        drawDetections(frame);
      } catch (err) {
        console.error('Error capturing frame:', err);
      }
    }, LIVE_FEED_FRAME_INTERVAL_MS);
  };

  useEffect(() => {
    if (isRunning && navigator.geolocation && geoWatchIdRef.current === null) {
      geoWatchIdRef.current = navigator.geolocation.watchPosition(
        (position) => setUserLocation({ lat: position.coords.latitude, lon: position.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
      );
    }
    return () => {
      if (geoWatchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
        geoWatchIdRef.current = null;
      }
    };
  }, [isRunning]);

  useEffect(() => {
    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (wsRef.current) { websocketAPI.disconnect(wsRef.current); wsRef.current = null; }
    };
  }, []);

  const drawDetections = (imageSrc) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      if (detections && Array.isArray(detections)) {
        detections.forEach((vehicle) => {
          const bbox = vehicle.bbox || vehicle.bounding_box;
          if (bbox) {
            const [x1, y1, x2, y2] = bbox;
            const color = vehicle.violation ? '#FF0000' : '#00FF00';
            ctx.strokeStyle = color;
            ctx.lineWidth = vehicle.violation ? 3 : 2;
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
            ctx.fillStyle = color;
            ctx.font = 'bold 14px Arial';
            ctx.fillText(
              `${vehicle.class || 'Vehicle'} ${vehicle.confidence ? (vehicle.confidence * 100).toFixed(0) + '%' : ''}`,
              x1, y1 - 5
            );
          }
        });
      }
    };
    img.src = imageSrc;
  };

  const severityStyle = (sev) => {
    switch ((sev || '').toLowerCase()) {
      case 'high':   return { badge: 'bg-red-600',    text: 'text-red-400',    border: 'border-red-700',    bg: 'bg-red-950/40' };
      case 'medium': return { badge: 'bg-orange-600', text: 'text-orange-400', border: 'border-orange-700', bg: 'bg-orange-950/30' };
      default:       return { badge: 'bg-yellow-600', text: 'text-yellow-400', border: 'border-yellow-700', bg: 'bg-yellow-950/20' };
    }
  };

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <audio id="siren-audio" src="/preview1.mp3" preload="auto" />
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">🎥 Live Feed</h1>
            <p className="text-sm text-gray-400">Real-time vehicle detection &amp; monitoring</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            ← Dashboard
          </button>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="bg-red-900 border border-red-700 rounded-lg p-4">
            <p className="text-red-200 text-sm">⚠️ {error}</p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left column: video + stats + accident history ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Video card */}
            <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
              <div className="relative bg-black">
                {isRunning ? (
                  <>
                    <Webcam
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      screenshotQuality={0.6}
                      width="100%"
                      videoConstraints={{ width: { ideal: 640 }, height: { ideal: 360 } }}
                      className="w-full"
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 w-full h-full"
                      style={{ mixBlendMode: 'screen' }}
                    />
                  </>
                ) : (
                  <div className="w-full aspect-video flex items-center justify-center bg-gray-900">
                    <div className="text-center">
                      <p className="text-4xl mb-4">📹</p>
                      <p className="text-gray-400">Click "Start Detection" to begin</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-gray-700">
                {!isRunning ? (
                  <button onClick={startStream} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition">
                    ▶️ Start Detection
                  </button>
                ) : (
                  <button onClick={stopStream} className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition">
                    ⏹️ Stop Detection
                  </button>
                )}
              </div>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Frames Sent', value: frameCount, color: 'text-blue-400' },
                { label: 'FPS',         value: fps,        color: 'text-green-400' },
                { label: 'Status',      value: connectionStatus === 'connected' ? '🟢' : '🔴', color: connectionStatus === 'connected' ? 'text-green-400' : 'text-red-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <p className="text-gray-400 text-sm">{label}</p>
                  <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* ── ACCIDENT HISTORY ── */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              {/* panel header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 bg-gray-800/80">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🚨</span>
                  <h3 className="font-semibold text-white text-base">Accident History</h3>
                  {accidentHistory.length > 0 && (
                    <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {accidentHistory.length}
                    </span>
                  )}
                </div>
                {accidentHistory.length > 0 && (
                  <button
                    onClick={() => { setAccidentHistory([]); lastAccidentIdRef.current = null; }}
                    className="text-xs text-gray-500 hover:text-red-400 transition"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* empty state */}
              {accidentHistory.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-4xl mb-2">🛡️</p>
                  <p className="text-gray-400 text-sm">No accidents detected this session</p>
                  <p className="text-gray-600 text-xs mt-1">History will appear here as accidents are detected</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700/60 max-h-96 overflow-y-auto">
                  {accidentHistory.map((acc, idx) => {
                    const sc = severityStyle(acc.severity);
                    const isLatest = idx === 0;
                    return (
                      <div
                        key={`${acc.id ?? 'null'}-${acc.timestamp}`}
                        className={`px-5 py-4 transition-colors ${isLatest ? sc.bg : 'hover:bg-gray-700/30'}`}
                      >
                        {/* row header */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isLatest && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-300 bg-red-900/70 px-2 py-0.5 rounded-full animate-pulse">
                                ● LATEST
                              </span>
                            )}
                            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded text-white ${sc.badge}`}>
                              {acc.severity}
                            </span>
                            {acc.id != null && (
                              <span className="text-xs text-gray-500 font-mono">#{acc.id}</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 shrink-0">{formatTime(acc.timestamp)}</span>
                        </div>

                        {/* details */}
                        <p className="text-sm text-gray-200 flex items-start gap-1 mb-1">
                          <span className="text-gray-500 mt-0.5">📍</span>
                          <span className="break-all">{acc.location}</span>
                        </p>
                        <p className="text-xs text-gray-400 mb-2">
                          🚗 {acc.vehicles} vehicle{acc.vehicles !== 1 ? 's' : ''} involved
                        </p>

                        {/* violation tags */}
                        {acc.violations.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {acc.violations.map((v, vi) => (
                              <span key={vi} className="text-xs bg-gray-700 text-gray-200 px-2 py-0.5 rounded">
                                {v.type || v}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Ola Maps top-5 hospitals */}
                        {acc.olaHospitals && acc.olaHospitals.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-gray-400 mb-1.5">🗺️ Nearby Hospitals (Ola Maps)</p>
                            <ol className="space-y-1.5">
                              {acc.olaHospitals.map((h) => (
                                <li key={h.placeId} className="text-xs flex items-start gap-2">
                                  <span className="shrink-0 bg-green-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold mt-0.5">{h.rank}</span>
                                  <span>
                                    <span className="text-white font-medium">{h.name}</span>
                                    {h.address && <span className="text-gray-500 block leading-tight">{h.address}</span>}
                                  </span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {/* Nearest hospital — dispatched to hospital portal */}
                        {acc.olaHospitals?.[0] ? (
                          <div className={`mt-3 p-2.5 rounded-lg border border-green-700 bg-green-950/40 text-xs mb-2`}>
                            <p className="text-green-400 font-semibold mb-0.5">🏥 Nearest Hospital Dispatched (Ola Maps)</p>
                            <p className="text-white font-semibold">{acc.olaHospitals[0].name}</p>
                            {acc.olaHospitals[0].address && (
                              <p className="text-gray-400 leading-tight">{acc.olaHospitals[0].address}</p>
                            )}
                            {acc.dispatchResult ? (
                              <div className="mt-2 space-y-1">
                                <p className="text-green-300 font-medium">✅ Alert sent to Hospital Portal</p>
                                {acc.dispatchResult.distance_km != null && (
                                  <p className="text-gray-400">
                                    📏 ~{acc.dispatchResult.distance_km} km · ETA ~{acc.dispatchResult.eta_minutes} min
                                  </p>
                                )}
                                <div className="bg-green-900/60 border border-green-600/40 rounded-lg px-3 py-2 mt-1">
                                  <p className="text-green-300 text-[11px] mb-0.5">Hospital Portal Login Code:</p>
                                  <p className="text-green-200 font-mono font-bold text-sm tracking-wider">
                                    {acc.dispatchResult.hospital_code}
                                  </p>
                                  <p className="text-green-500/60 text-[10px] mt-0.5">
                                    Use at <span className="underline">/hospital-login</span> to manage this request
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-yellow-400 mt-1">⏳ Dispatching to portal…</p>
                            )}
                          </div>
                        ) : acc.emergency?.selected_hospital ? (
                          <div className={`mt-3 p-2.5 rounded-lg border ${sc.border} bg-gray-900/60 text-xs mb-2`}>
                            <p className="text-gray-400 mb-0.5">🏥 Nearest Hospital Dispatched</p>
                            <p className="text-white font-semibold">{acc.emergency.selected_hospital.name}</p>
                            <p className={sc.text}>
                              ~{Number(acc.emergency.selected_hospital.distance_km).toFixed(2)} km
                              &nbsp;·&nbsp;ETA ~{acc.emergency.selected_hospital.eta_minutes} min
                            </p>
                          </div>
                        ) : null}

                        {/* map link — passes Ola hospitals to map page */}
                        {acc.accidentLat != null && (
                          <Link
                            to={`/map?accidentLat=${acc.accidentLat}&accidentLon=${acc.accidentLon}&olaHospitals=${encodeURIComponent(JSON.stringify(acc.olaHospitals ?? []))}`}
                            className="inline-block mt-1 text-xs text-blue-400 hover:text-blue-300 underline"
                          >
                            View on map →
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Right column: detection results ── */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 self-start">
            <h3 className="text-lg font-semibold mb-4">📊 Detection Results</h3>

            {!isRunning ? (
              <p className="text-gray-400 text-sm">Start detection to see results</p>
            ) : latestDetection ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-300 mb-2">Detected Vehicles: {detections.length}</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {detections.map((vehicle, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded text-sm ${vehicle.violation ? 'bg-red-900 border border-red-700' : 'bg-green-900 border border-green-700'}`}
                      >
                        <p className="font-medium">{vehicle.class || `Vehicle ${idx + 1}`}</p>
                        {vehicle.confidence && (
                          <p className="text-xs text-gray-300">Confidence: {(vehicle.confidence * 100).toFixed(0)}%</p>
                        )}
                        {vehicle.violation && (
                          <p className="text-xs text-red-300 mt-1">⚠️ {vehicle.violation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {latestDetection.violations?.length > 0 && (
                  <div className="border-t border-gray-700 pt-4">
                    <p className="text-sm font-semibold text-red-400 mb-2">🚨 Violations: {latestDetection.violations.length}</p>
                    <div className="space-y-2">
                      {latestDetection.violations.map((v, idx) => (
                        <div key={idx} className="p-2 bg-red-900 rounded text-xs">{v.type || v}</div>
                      ))}
                    </div>
                  </div>
                )}

                {latestDetection.accident && (
                  <div className="border-t border-yellow-500 pt-4">
                    <p className="text-lg font-bold text-yellow-400 mb-2">🚨 Collision Detected!</p>
                    <p className="text-sm text-yellow-300">Severity: {latestDetection.severity}</p>
                    <p className="text-sm text-yellow-300">Location: {latestDetection.location || 'Unknown'}</p>
                  </div>
                )}

                {latestDetection.accident && latestDetection.emergency?.selected_hospital && (
                  <div className="border-t border-red-600 pt-4 space-y-3">
                    <p className="text-sm font-bold text-red-300">🏥 Nearest ER</p>
                    <div className="p-3 bg-red-950/80 rounded border border-red-700">
                      <p className="font-semibold text-white">{latestDetection.emergency.selected_hospital.name}</p>
                      <p className="text-xs text-red-200 mt-1">
                        ~{Number(latestDetection.emergency.selected_hospital.distance_km).toFixed(2)} km · ETA ~{latestDetection.emergency.selected_hospital.eta_minutes} min
                      </p>
                      {latestDetection.emergency.selected_hospital.phone && (
                        <p className="text-xs text-gray-300 mt-1">📞 {latestDetection.emergency.selected_hospital.phone}</p>
                      )}
                      <p className="text-xs text-green-400 mt-2">Hospital notified.</p>
                    </div>
                    {latestDetection.emergency.accident_lat != null && (
                      <Link
                        to={`/map?accidentLat=${latestDetection.emergency.accident_lat}&accidentLon=${latestDetection.emergency.accident_lon}`}
                        className="inline-block text-sm text-blue-400 hover:text-blue-300 underline"
                      >
                        Open map →
                      </Link>
                    )}
                  </div>
                )}

                {latestDetection.accident && latestDetection.emergency?.message && (
                  <p className="text-xs text-amber-400 border-t border-amber-700 pt-2">{latestDetection.emergency.message}</p>
                )}
                {latestDetection.accident && latestDetection.emergency?.error && (
                  <p className="text-xs text-red-400">Emergency routing: {latestDetection.emergency.error}</p>
                )}

                <div className="bg-gray-900 border border-gray-700 rounded p-2 text-xs text-gray-300 max-h-48 overflow-auto">
                  <strong>Raw output:</strong>
                  <pre className="whitespace-pre-wrap mt-1">{JSON.stringify(latestDetection, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Waiting for first frame...</p>
            )}

            <div className="mt-6 border-t border-gray-700 pt-4 space-y-1">
              <p className="text-xs text-gray-400">
                Connection: {connectionStatus === 'connected' ? '🟢 Connected' : '🔴 Disconnected'}
              </p>
              <p className="text-xs text-gray-500">
                Frame rate: every {LIVE_FEED_FRAME_INTERVAL_MS}ms (~{Math.round(1000 / LIVE_FEED_FRAME_INTERVAL_MS)} FPS cap)
              </p>
              {latestDetection?.snapshot_path && (
                <p className="text-xs text-green-400">Snapshot: {latestDetection.snapshot_path}</p>
              )}
              {wsDebug && (
                <pre className="mt-2 text-[10px] text-gray-500 whitespace-pre-wrap break-all max-h-28 overflow-auto bg-gray-900/80 p-2 rounded border border-gray-700">
                  {JSON.stringify(wsDebug, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 bg-blue-900/60 border border-blue-700 rounded-xl p-4">
          <p className="text-sm text-blue-200">
            💡 <strong>How it works:</strong> Frames are streamed over WebSocket at ~{Math.round(1000 / LIVE_FEED_FRAME_INTERVAL_MS)} FPS.
            The backend saves a DB record &amp; snapshot only when violations or an accident are detected.
            Accident history accumulates in this session and is cleared when you refresh or click "Clear all".
          </p>
        </div>
      </div>
    </div>
  );
}
