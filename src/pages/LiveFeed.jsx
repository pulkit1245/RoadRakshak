import React, { useRef, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import { motion, AnimatePresence } from 'framer-motion';
import { websocketAPI, getWebSocketUrl, olaMapsAPI } from '../services/api';

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
  const detectionsRef = useRef([]); 
  const [fps, setFps] = useState(0);
  const [latestDetection, setLatestDetection] = useState(null);
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [wsDebug, setWsDebug] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const geoWatchIdRef = useRef(null);
  const userLocationRef = useRef(null);

  const [accidentHistory, setAccidentHistory] = useState([]);
  const lastAccidentIdRef = useRef(null);
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

        if (data.accident) {
          const incidentId = data.id;
          if (incidentId && incidentId !== lastAccidentIdRef.current) {
            lastAccidentIdRef.current = incidentId;

            try { 
              const audioEl = document.getElementById('siren-audio');
              if (audioEl) {
                audioEl.currentTime = 0;
                audioEl.play().catch(e => console.error("Audio play blocked by browser:", e));
              }
            } catch (e) { console.error(e); }

            const accLat = data.emergency?.accident_lat ?? userLocationRef.current?.lat ?? null;
            const accLon = data.emergency?.accident_lon ?? userLocationRef.current?.lon ?? null;

            const olaFetch = (accLat != null && accLon != null)
              ? olaMapsAPI.getNearbyHospitals(accLat, accLon)
              : Promise.resolve([]);

            olaFetch.then((hospitals) => {
              setOlaHospitals(hospitals);

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
      case 'high':   return { badge: 'bg-brand-danger', text: 'text-brand-danger', glow: 'glow-border-danger', bg: 'bg-brand-danger/10' };
      case 'medium': return { badge: 'bg-brand-warning', text: 'text-brand-warning', glow: 'glow-border-warning', bg: 'bg-brand-warning/10' };
      default:       return { badge: 'bg-brand-accent', text: 'text-brand-accent', glow: 'glow-border-accent', bg: 'bg-brand-accent/10' };
    }
  };

  const formatTime = (iso) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="min-h-screen bg-brand-dark text-white font-sans selection:bg-brand-accent/30 relative">
      <div className="bg-orb bg-orb-blue"></div>
      <div className="bg-orb bg-orb-purple"></div>

      <audio id="siren-audio" src="/preview1.mp3" preload="auto" />

      {/* Tactical Header */}
      <nav className="glass-panel sticky top-0 z-[500] border-0 border-b border-brand-border/40" style={{ borderRadius: 0 }}>
        <div className="max-w-[1600px] mx-auto px-6 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-brand-accent/15 rounded-xl flex items-center justify-center border border-brand-accent/20 shadow-glow-blue">
              <span className="text-xl">📹</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight uppercase">Control <span className="text-brand-accent">Center</span></h1>
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-brand-success animate-pulse-glow shadow-glow-green' : 'bg-brand-danger shadow-glow-red'}`}></span>
                <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">
                  {connectionStatus === 'connected' ? 'Uplink Established' : 'Signal Lost'} • Remote Node: 127.0.0.1
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="nav-link-3d"
          >
            <span>←</span> Return to Dashboard
          </button>
        </div>
      </nav>

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="max-w-[1600px] mx-auto px-6 py-4 relative z-10">
          <div className="glass-panel glow-border-danger p-4 flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.08)' }}>
            <span className="text-brand-danger">⚠️</span>
            <p className="text-brand-danger text-[10px] font-bold uppercase tracking-widest">System Alert: {error}</p>
          </div>
        </motion.div>
      )}

      <main className="max-w-[1600px] mx-auto px-6 py-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── Visual Feed & Telemetry (Left) ── */}
          <div className="lg:col-span-8 space-y-6">

            {/* Main Visual Node */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="card-3d overflow-hidden border-brand-border/60">
              <div className="relative aspect-video bg-black group" style={{ boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8)' }}>
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
                    <div className="absolute inset-0 pointer-events-none border-[20px] border-transparent border-t-white/5 border-b-white/5 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]"></div>
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:100%_4px]"></div>
                    <div className="absolute top-6 left-6 flex flex-col gap-1">
                      <div className="bg-brand-accent px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest shadow-glow-blue text-white">Live Stream</div>
                      <div className="glass-panel border-0 px-2 py-0.5 rounded text-[10px] font-mono text-gray-300">REC: {new Date().toISOString().split('T')[1].split('.')[0]}</div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-brand-dark">
                    <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity }} className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                      <span className="text-4xl opacity-50">📹</span>
                    </motion.div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Node Standby • Waiting for Uplink</p>
                  </div>
                )}
              </div>

              <div className="p-4 glass-panel border-0 border-t border-white/10 flex items-center justify-between rounded-none" style={{ background: 'rgba(255,255,255,0.02)' }}>
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
                  <button onClick={startStream} className="btn-3d-accent text-[10px] font-black uppercase tracking-[0.2em]">
                    Establish Uplink
                  </button>
                ) : (
                  <button onClick={stopStream} className="btn-3d-danger text-[10px] font-black uppercase tracking-[0.2em]">
                    Terminate Link
                  </button>
                )}
              </div>
            </motion.div>

            {/* Accident History Stack */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="card-3d flex flex-col h-[450px]">
              <div className="px-6 py-4 border-b border-brand-border/50 glass-panel rounded-none border-0 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-brand-danger text-sm">🚨</span>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Incident History Log</h3>
                  {accidentHistory.length > 0 && (
                    <span className="bg-brand-danger text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-glow-red">
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
                    <motion.p animate={{ y: [0, -5, 0] }} transition={{ duration: 3, repeat: Infinity }} className="text-6xl mb-4">🛡️</motion.p>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Visual Anomalies Detected</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AnimatePresence>
                      {accidentHistory.map((acc, idx) => {
                        const sc = severityStyle(acc.severity);
                        return (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            key={`${acc.id}-${idx}`} 
                            className={`card-3d p-5 relative group overflow-hidden ${sc.glow}`}
                            style={{ background: 'rgba(17,24,39,0.8)' }}
                          >
                            <div className="flex justify-between items-start mb-4">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest text-white ${sc.badge} shadow-md`}>
                                {acc.severity} Impact
                              </span>
                              <span className="text-[10px] font-mono text-gray-400 font-bold">{formatTime(acc.timestamp)}</span>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <span className="text-lg">📍</span>
                                <p className="text-[11px] font-bold text-gray-200 truncate">{acc.location}</p>
                              </div>

                              {acc.olaHospitals?.length > 0 && (
                                <div className="space-y-1.5 pt-2 border-t border-white/5">
                                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Medical Hubs Identified</p>
                                  {acc.olaHospitals.slice(0, 3).map((h, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 bg-brand-success rounded-full shadow-glow-green"></div>
                                      <p className="text-[10px] font-medium text-gray-400 truncate">{h.name}</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {acc.olaHospitals?.[0] && (
                                <div className="mt-4 p-3 rounded-xl bg-black/40 border border-white/5 shadow-inner">
                                  <p className="text-[9px] font-black text-brand-success uppercase tracking-widest mb-1">Target Portal Uplink</p>
                                  {acc.dispatchResult ? (
                                    <div className="space-y-2">
                                      <p className="text-[11px] font-black text-white">{acc.dispatchResult.hospital_name}</p>
                                      <div className="flex items-center justify-between">
                                        <div className="glass-panel border-brand-success/20 text-brand-success text-[14px] font-mono font-black px-3 py-1 bg-brand-success/10">
                                          {acc.dispatchResult.hospital_code}
                                        </div>
                                        <div className="text-right">
                                          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">Distance / ETA</p>
                                          <p className="text-[10px] font-black text-gray-300">~{acc.dispatchResult.distance_km}km • {acc.dispatchResult.eta_minutes}m</p>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-[10px] font-bold text-brand-warning animate-pulse-glow uppercase">Initiating Secure Handshake...</p>
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
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* ── Intelligence Hub (Right) ── */}
          <div className="lg:col-span-4 space-y-6">

            {/* Live Telemetry Node */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="glass-panel h-[calc(100vh-200px)] sticky top-28 flex flex-col">
              <div className="px-6 py-4 border-b border-white/10 bg-white/5">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-brand-accent">Live Telemetry Node</h3>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {!isRunning ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
                    <motion.p animate={{ y: [0, -5, 0] }} transition={{ duration: 4, repeat: Infinity }} className="text-4xl mb-4">🛰️</motion.p>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Awaiting Data Stream</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Object Counter */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="card-3d p-4 text-center glow-border-accent" style={{ background: 'rgba(59,130,246,0.05)' }}>
                        <p className="text-[9px] font-black text-brand-accent uppercase tracking-widest mb-1">Vehicles</p>
                        <p className="text-3xl font-black tabular-nums">{detections.length}</p>
                      </div>
                      <div className="card-3d p-4 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Threat Level</p>
                        <p className={`text-3xl font-black ${detections.some(v => v.violation) ? 'text-brand-danger glow-text-red' : 'text-brand-success'}`}>
                          {detections.some(v => v.violation) ? 'HI' : 'LO'}
                        </p>
                      </div>
                    </div>

                    {/* Detections List */}
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-1">Detected Assets</p>
                      <div className="space-y-2">
                        <AnimatePresence>
                          {detections.map((vehicle, idx) => (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              key={idx}
                              className={`p-3 card-3d flex items-center justify-between group transition-all ${vehicle.violation ? 'glow-border-danger bg-brand-danger/5' : 'bg-white/5 border-white/10'}`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-lg">{vehicle.class === 'motorcycle' ? '🏍️' : '🚗'}</span>
                                <div>
                                  <p className="text-[11px] font-black uppercase tracking-tight text-white">{vehicle.class || 'Asset'}</p>
                                  <p className="text-[9px] font-bold text-gray-500 tabular-nums">Conf: {(vehicle.confidence * 100).toFixed(0)}%</p>
                                </div>
                              </div>
                              {vehicle.violation && (
                                <div className="bg-brand-danger text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter shadow-glow-red">
                                  {vehicle.violation}
                                </div>
                              )}
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-black/40 border-t border-white/10">
                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">
                  <span>Logic Core</span>
                  <span className="text-brand-accent">v2.1.0-Tactical</span>
                </div>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full bg-brand-accent animate-pulse w-3/4 shadow-glow-blue"></div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
