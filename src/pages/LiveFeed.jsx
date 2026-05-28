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
  const detectionsRef = useRef([]); // Fix stale closure for canvas drawing
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
          // Only process if it's a NEW incident (has a valid database ID)
          if (incidentId && incidentId !== lastAccidentIdRef.current) {
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
                  vehicles: data.vehicles_count || 0,
                  hospital: hospitals[0],
                  accidentLat: accLat,
                  accidentLon: accLon,
                  snapshotBase64: data.annotated_frame || null,
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

        if (data.vehicles && Array.isArray(data.vehicles)) {
          setDetections(data.vehicles);
          detectionsRef.current = data.vehicles;
        }
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
      const currentDetections = detectionsRef.current;
      if (currentDetections && Array.isArray(currentDetections)) {
        currentDetections.forEach((vehicle) => {
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
    <div className="min-h-screen bg-brand-dark text-white font-sans selection:bg-brand-accent/30">
      <audio id="siren-audio" src="/preview1.mp3" preload="auto" />

      {/* Tactical Header */}
      <nav className="sticky top-0 z-50 bg-brand-dark/80 backdrop-blur-xl border-b border-brand-border/50">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-brand-accent rounded-xl flex items-center justify-center shadow-lg shadow-brand-accent/20">
              <span className="text-xl">📹</span>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight uppercase">Control <span className="text-brand-accent">Center</span></h1>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-brand-success animate-pulse' : 'bg-brand-danger'}`}></span>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                  {connectionStatus === 'connected' ? 'Uplink Established' : 'Signal Lost'} • Remote Node: 127.0.0.1
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
          >
            <span>←</span> Return to Dashboard
          </button>
        </div>
      </nav>

      {error && (
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="bg-brand-danger/10 border border-brand-danger/30 rounded-xl p-4 flex items-center gap-3">
            <span className="text-brand-danger">⚠️</span>
            <p className="text-brand-danger text-[10px] font-bold uppercase tracking-widest">System Alert: {error}</p>
          </div>
        </div>
      )}

      <main className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── Visual Feed & Telemetry (Left) ── */}
          <div className="lg:col-span-8 space-y-6">

            {/* Main Visual Node */}
            <div className="glass-card overflow-hidden border-none ring-1 ring-white/10">
              <div className="relative aspect-video bg-black group">
                {isRunning ? (
                  <>
                    <Webcam
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      screenshotQuality={0.6}
                      width="100%"
                      videoConstraints={{ width: { ideal: 1280 }, height: { ideal: 720 } }}
                      className="w-full h-full object-cover opacity-80"
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 w-full h-full"
                      style={{ mixBlendMode: 'screen' }}
                    />
                    {/* HUD Overlay */}
                    <div className="absolute inset-0 pointer-events-none border-[20px] border-transparent border-t-white/5 border-b-white/5"></div>
                    <div className="absolute top-6 left-6 flex flex-col gap-1">
                      <div className="bg-brand-accent px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">Live Stream</div>
                      <div className="bg-black/50 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-gray-300">REC: {new Date().toISOString().split('T')[1].split('.')[0]}</div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-brand-dark">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
                      <span className="text-4xl opacity-50">📹</span>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Node Standby • Waiting for Uplink</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-white/5 border-t border-white/10 flex items-center justify-between">
                <div className="flex gap-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">Frames Transmitted</span>
                    <span className="text-sm font-black tabular-nums text-brand-accent">{frameCount.toLocaleString()}</span>
                  </div>
                  <div className="w-px h-8 bg-white/10"></div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">Throughput Rate</span>
                    <span className="text-sm font-black tabular-nums text-brand-success">{fps} FPS</span>
                  </div>
                </div>

                {!isRunning ? (
                  <button onClick={startStream} className="px-8 py-3 bg-brand-accent hover:bg-brand-accent/80 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-brand-accent/20">
                    Establish Uplink
                  </button>
                ) : (
                  <button onClick={stopStream} className="px-8 py-3 bg-brand-danger hover:bg-brand-danger/80 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-brand-danger/20">
                    Terminate Link
                  </button>
                )}
              </div>
            </div>

            {/* Accident History Stack */}
            <div className="glass-card flex flex-col h-[450px]">
              <div className="px-6 py-4 border-b border-brand-border/50 bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-brand-danger text-sm">🚨</span>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Incident History Log</h3>
                  {accidentHistory.length > 0 && (
                    <span className="bg-brand-danger text-white text-[10px] font-black px-2 py-0.5 rounded-full ring-4 ring-brand-danger/20">
                      {accidentHistory.length}
                    </span>
                  )}
                </div>
                {accidentHistory.length > 0 && (
                  <button
                    onClick={() => { setAccidentHistory([]); lastAccidentIdRef.current = null; }}
                    className="text-[10px] font-bold uppercase text-gray-500 hover:text-brand-danger transition"
                  >
                    Wipe Log
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {accidentHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 grayscale">
                    <p className="text-6xl mb-4">🛡️</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Visual Anomalies Detected</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {accidentHistory.map((acc, idx) => {
                      const sc = severityStyle(acc.severity);
                      return (
                        <div key={`${acc.id}-${idx}`} className={`p-5 rounded-2xl border ${sc.border} ${sc.bg} relative group overflow-hidden`}>
                          <div className="flex justify-between items-start mb-4">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest text-white ${sc.badge}`}>
                              {acc.severity} Impact
                            </span>
                            <span className="text-[10px] font-mono text-gray-400 font-bold">{formatTime(acc.timestamp)}</span>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">📍</span>
                              <p className="text-[11px] font-bold text-gray-200 truncate">{acc.location}</p>
                            </div>

                            {/* Nearby Hospitals */}
                            {acc.olaHospitals?.length > 0 && (
                              <div className="space-y-1.5 pt-2 border-t border-white/5">
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Medical Hubs Identified</p>
                                {acc.olaHospitals.slice(0, 3).map((h, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <div className="w-1 h-1 bg-brand-success rounded-full"></div>
                                    <p className="text-[10px] font-medium text-gray-400 truncate">{h.name}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Dispatch Status */}
                            {acc.olaHospitals?.[0] && (
                              <div className="mt-4 p-3 rounded-xl bg-black/40 border border-white/5">
                                <p className="text-[9px] font-black text-brand-success uppercase tracking-widest mb-1">Target Portal Uplink</p>
                                {acc.dispatchResult ? (
                                  <div className="space-y-2">
                                    <p className="text-[11px] font-black text-white">{acc.dispatchResult.hospital_name}</p>
                                    <div className="flex items-center justify-between">
                                      <div className="bg-brand-success/10 text-brand-success text-[14px] font-mono font-black px-3 py-1 rounded-lg border border-brand-success/20">
                                        {acc.dispatchResult.hospital_code}
                                      </div>
                                      <div className="text-right">
                                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">Distance / ETA</p>
                                        <p className="text-[10px] font-black text-gray-300">~{acc.dispatchResult.distance_km}km • {acc.dispatchResult.eta_minutes}m</p>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[10px] font-bold text-brand-warning animate-pulse uppercase">Initiating Secure Handshake...</p>
                                )}
                              </div>
                            )}
                          </div>

                          <Link 
                            to={`/map?accidentLat=${acc.accidentLat}&accidentLon=${acc.accidentLon}`}
                            className="absolute bottom-4 right-5 text-[10px] font-black text-brand-accent uppercase tracking-widest hover:underline"
                          >
                            Track Site →
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Intelligence Hub (Right) ── */}
          <div className="lg:col-span-4 space-y-6">

            {/* Live Telemetry Node */}
            <div className="glass-card overflow-hidden h-[calc(100vh-200px)] sticky top-28 flex flex-col">
              <div className="px-6 py-4 border-b border-brand-border/50 bg-white/5">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-brand-accent">Live Telemetry Node</h3>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {!isRunning ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
                    <p className="text-4xl mb-4">🛰️</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Awaiting Data Stream</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Object Counter */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-brand-accent/10 border border-brand-accent/20 rounded-2xl text-center">
                        <p className="text-[9px] font-black text-brand-accent uppercase tracking-widest mb-1">Vehicles</p>
                        <p className="text-3xl font-black tabular-nums">{detections.length}</p>
                      </div>
                      <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Threat Level</p>
                        <p className={`text-3xl font-black ${detections.some(v => v.violation) ? 'text-brand-danger' : 'text-brand-success'}`}>
                          {detections.some(v => v.violation) ? 'HI' : 'LO'}
                        </p>
                      </div>
                    </div>

                    {/* Detections List */}
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">Detected Assets</p>
                      <div className="space-y-2">
                        {detections.map((vehicle, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border flex items-center justify-between group transition-all ${vehicle.violation ? 'bg-brand-danger/10 border-brand-danger/30' : 'bg-white/5 border-white/10'}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg">{vehicle.class === 'motorcycle' ? '🏍️' : '🚗'}</span>
                              <div>
                                <p className="text-[11px] font-black uppercase tracking-tight text-white">{vehicle.class || 'Asset'}</p>
                                <p className="text-[9px] font-bold text-gray-500 tabular-nums">Conf: {(vehicle.confidence * 100).toFixed(0)}%</p>
                              </div>
                            </div>
                            {vehicle.violation && (
                              <div className="bg-brand-danger text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                {vehicle.violation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* System Footer Info */}
              <div className="p-4 bg-black/30 border-t border-brand-border/50">
                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-2">
                  <span>Logic Core</span>
                  <span className="text-brand-accent">v2.1.0-Tactical</span>
                </div>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-accent animate-pulse w-3/4"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
