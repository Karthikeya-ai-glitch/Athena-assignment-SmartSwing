import React, { useState, useEffect, useRef } from 'react';
import { Camera, Home, Activity, Calendar, Upload, ChevronRight, TrendingUp, User, Play, RotateCcw, X, AlertCircle } from 'lucide-react';

// --- INDEXED DB UTILS (For storing large video files) ---
const DB_NAME = 'SmartSwingDB';
const STORE_NAME = 'replays';

const initDB = () => {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
};

const saveVideo = async (blob) => {
  const db = await initDB();
  if (!db) return null;
  const id = Date.now().toString();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, id);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => resolve(null);
  });
};

const getVideo = async (id) => {
  const db = await initDB();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
};

const deleteVideo = async (id) => {
    const db = await initDB();
    if (!db) return;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
};

// --- HELPER: Load External Scripts (MediaPipe) ---
const useScript = (src) => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => setLoaded(true);
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [src]);
  return loaded;
};

// --- GEOMETRY UTILS ---
const getMidPoint = (p1, p2) => {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    z: (p1.z + p2.z) / 2,
    visibility: (p1.visibility + p2.visibility) / 2
  };
};

const calculateSlope = (p1, p2) => {
  return Math.abs((p2.y - p1.y) / (p2.x - p1.x));
};

// --- COMPONENT: MAIN APP ---
export default function App() {
  const [view, setView] = useState('home'); 
  
  const poseLoaded = useScript("https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js");
  const cameraUtilsLoaded = useScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
  const drawingUtilsLoaded = useScript("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js");
  
  const isReady = poseLoaded && cameraUtilsLoaded && drawingUtilsLoaded;

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mb-4"></div>
        <p className="text-slate-400">Loading SmartSwing AI...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden max-w-md mx-auto shadow-2xl relative">
      <header className="bg-slate-800 p-4 flex justify-between items-center shadow-md z-10 relative">
        <div className="flex items-center space-x-2">
          <Activity className="text-cyan-400 w-6 h-6" />
          <h1 className="font-bold text-xl tracking-tight">Smart<span className="text-cyan-400">Swing</span></h1>
        </div>
        <div className="text-xs text-slate-400 flex items-center">
          <User className="w-3 h-3 mr-1" />
          Golfer
        </div>
      </header>

      <main className="h-[calc(100vh-140px)] overflow-y-auto">
        {view === 'home' && <HomeView setView={setView} />}
        {view === 'record' && <RecordView setView={setView} />}
        {view === 'history' && <HistoryView />}
      </main>

      <nav className="absolute bottom-0 w-full bg-slate-800 border-t border-slate-700 h-16 flex justify-around items-center px-2 z-20">
        <NavButton icon={Home} label="Home" active={view === 'home'} onClick={() => setView('home')} />
        <div className="relative -top-5">
           <button 
             onClick={() => setView('record')}
             className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 p-4 rounded-full shadow-lg border-4 border-slate-900 transition-transform active:scale-95"
           >
             <Camera className="w-8 h-8" />
           </button>
        </div>
        <NavButton icon={Calendar} label="History" active={view === 'history'} onClick={() => setView('history')} />
      </nav>
    </div>
  );
}

const NavButton = ({ icon: Icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center w-16 ${active ? 'text-cyan-400' : 'text-slate-500'}`}
  >
    <Icon className="w-6 h-6 mb-1" />
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

const HomeView = ({ setView }) => {
  const [stats, setStats] = useState({ sessions: 0, avgScore: 0 });

  useEffect(() => {
    const savedData = JSON.parse(localStorage.getItem('smartSwingData') || '[]');
    if (savedData.length > 0) {
      const avg = Math.round(savedData.reduce((a, b) => a + b.score, 0) / savedData.length);
      setStats({ sessions: savedData.length, avgScore: avg });
    }
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="bg-gradient-to-br from-cyan-600 to-blue-800 rounded-2xl p-6 text-white shadow-lg">
        <h2 className="text-lg font-semibold mb-1 opacity-90">Swing Trainer</h2>
        <p className="text-3xl font-bold mb-4">Start Analysis</p>
        <button 
          onClick={() => setView('record')}
          className="bg-white text-blue-900 px-4 py-2 rounded-full font-bold text-sm hover:bg-blue-50 transition-colors flex items-center"
        >
          New Session <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard title="Avg Score" value={stats.avgScore} icon={TrendingUp} color="text-cyan-400" />
        <StatCard title="Sessions" value={stats.sessions} icon={Activity} color="text-purple-400" />
      </div>

      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">Features</h3>
        <ul className="space-y-3 text-sm text-slate-300">
           <li className="flex items-center"><Activity className="w-4 h-4 mr-2 text-cyan-400"/> Spine Angle Detection</li>
           <li className="flex items-center"><TrendingUp className="w-4 h-4 mr-2 text-yellow-400"/> Club Path Tracing</li>
           <li className="flex items-center"><Play className="w-4 h-4 mr-2 text-purple-400"/> GIF Replay Mode</li>
        </ul>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center justify-center py-6">
    <Icon className={`w-6 h-6 ${color} mb-2`} />
    <span className="text-2xl font-bold text-white">{value}</span>
    <span className="text-xs text-slate-400">{title}</span>
  </div>
);

const HistoryView = () => {
  const [swings, setSwings] = useState([]);
  const [videoUrl, setVideoUrl] = useState(null);

  useEffect(() => {
    try {
      const savedData = JSON.parse(localStorage.getItem('smartSwingData') || '[]');
      // Sort strictly by timestamp for graph
      const sorted = savedData.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
      setSwings(sorted); 
    } catch (e) {
      console.error("Data error", e);
    }
  }, []);

  const clearHistory = () => {
    if(confirm("Delete all swing history?")) {
      swings.forEach(s => { if(s.videoId) deleteVideo(s.videoId); });
      localStorage.removeItem('smartSwingData');
      setSwings([]);
    }
  };

  const playReplay = async (videoId) => {
    if (!videoId) return;
    const blob = await getVideo(videoId);
    if (blob) {
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    } else {
      alert("Video not found (storage cleared?)");
    }
  };

  // --- GRAPH COMPONENT ---
  const PerformanceGraph = () => {
      if (swings.length < 2) return null;

      // Prepare Data
      const data = swings.slice(-10); // Last 10 sessions
      const scores = data.map(s => s.score);
      const avgScore = Math.round(scores.reduce((a,b) => a+b, 0) / scores.length);
      
      // Dimensions
      const width = 300;
      const height = 120;
      const padding = 10;
      
      // Scaling
      const getX = (i) => (i / (data.length - 1)) * (width - 2 * padding) + padding;
      const getY = (score) => height - padding - ((score / 100) * (height - 2 * padding));

      // Build Path
      let pathD = `M ${getX(0)} ${getY(scores[0])}`;
      scores.forEach((score, i) => {
         if (i === 0) return;
         pathD += ` L ${getX(i)} ${getY(score)}`;
      });

      // Build Average Line
      const avgY = getY(avgScore);

      return (
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-6">
           <div className="flex justify-between items-end mb-4">
              <h3 className="text-slate-400 text-xs uppercase font-bold">Performance Trend</h3>
              <div className="text-right">
                  <span className="text-xs text-slate-500 mr-2">Avg: {avgScore}</span>
                  <span className="text-xs text-cyan-400">Current</span>
              </div>
           </div>
           
           <div className="relative w-full h-32 overflow-hidden">
               <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                   {/* Gradient Defs */}
                   <defs>
                       <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
                           <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                       </linearGradient>
                   </defs>

                   {/* Fill Area */}
                   <path 
                      d={`${pathD} L ${getX(scores.length-1)} ${height} L ${getX(0)} ${height} Z`} 
                      fill="url(#lineGradient)" 
                   />

                   {/* Average Line (Dashed) */}
                   <line x1="0" y1={avgY} x2={width} y2={avgY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
                   
                   {/* Trend Line */}
                   <path d={pathD} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                   {/* Points */}
                   {scores.map((score, i) => (
                       <circle 
                         key={i} 
                         cx={getX(i)} 
                         cy={getY(score)} 
                         r="3" 
                         fill="#fff" 
                         stroke="#22d3ee" 
                         strokeWidth="2"
                       />
                   ))}
               </svg>
           </div>
           <div className="flex justify-between text-[10px] text-slate-500 mt-2">
               <span>Oldest</span>
               <span>Newest</span>
           </div>
        </div>
      );
  };

  const getScoreColor = (val) => {
    if (val >= 80) return 'text-green-400';
    if (val >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="p-4 space-y-6 relative">
      {/* VIDEO REPLAY MODAL */}
      {videoUrl && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <button 
            onClick={() => { setVideoUrl(null); URL.revokeObjectURL(videoUrl); }}
            className="absolute top-4 right-4 text-white p-2"
          >
            <X className="w-8 h-8" />
          </button>
          <div className="relative w-full max-w-lg">
             <video 
               src={videoUrl} 
               autoPlay 
               loop 
               playsInline 
               className="w-full rounded border border-cyan-500 shadow-2xl"
             />
             <div className="absolute bottom-2 left-2 text-white bg-black/60 px-2 py-1 text-xs rounded animate-pulse">
                REPLAYING ANALYSIS
             </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Your Swings</h2>
        {swings.length > 0 && (
          <button onClick={clearHistory} className="text-xs text-red-400 border border-red-900 p-2 rounded hover:bg-red-900/20">Clear All</button>
        )}
      </div>
      
      {/* Comparison Graph */}
      <PerformanceGraph />

      {swings.length === 0 ? (
        <div className="text-center text-slate-500 py-10">No sessions recorded yet.</div>
      ) : (
        <div className="space-y-4">
          {/* Display reversed for list (Newest first) */}
          {[...swings].reverse().map((swing, index) => (
            <div key={index} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col gap-3">
               <div className="flex justify-between items-start">
                  <div>
                      <div className="text-white font-semibold flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-2 ${swing.score >= 80 ? 'bg-green-500' : 'bg-yellow-500'}`}/>
                        {new Date(swing.timestamp).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-slate-400">
                        {new Date(swing.timestamp).toLocaleTimeString()}
                      </div>
                  </div>
                  <div className="text-2xl font-bold text-cyan-400">{swing.score}</div>
               </div>

               {/* DETAILED BREAKDOWN (If Available) */}
               {swing.breakdown && (
                 <div className="bg-slate-900/50 rounded-lg p-3 text-xs mt-2">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="flex justify-between">
                            <span className="text-slate-400">Stability</span>
                            <span className={getScoreColor(swing.breakdown.stability)}>{Math.round(swing.breakdown.stability)}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Rotation</span>
                            <span className={getScoreColor(swing.breakdown.rotation)}>{Math.round(swing.breakdown.rotation)}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Extension</span>
                            <span className={getScoreColor(swing.breakdown.extension)}>{Math.round(swing.breakdown.extension)}%</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Tempo</span>
                            <span className={getScoreColor(swing.breakdown.tempo)}>{Math.round(swing.breakdown.tempo)}%</span>
                        </div>
                    </div>
                    {swing.feedbackText && (
                        <div className="border-t border-slate-700 pt-2 flex items-start text-white">
                           <AlertCircle className="w-3 h-3 text-yellow-500 mr-2 mt-0.5 shrink-0" />
                           <span>{swing.feedbackText}</span>
                        </div>
                    )}
                 </div>
               )}
               
               {swing.videoId ? (
                 <button 
                   onClick={() => playReplay(swing.videoId)}
                   className="w-full h-24 bg-black rounded-lg overflow-hidden relative border border-slate-600 group mt-1 flex items-center justify-center"
                 >
                    <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                        <Activity className="text-slate-700 w-full h-full opacity-20" />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <span className="bg-cyan-600 text-white text-xs px-3 py-1.5 rounded-full flex items-center shadow-lg hover:scale-105 transition-transform">
                        <Play className="w-3 h-3 mr-1 fill-white"/> Watch Replay
                      </span>
                    </div>
                 </button>
               ) : (
                 <div className="text-xs text-slate-500 italic">No recording available</div>
               )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const RecordView = ({ setView }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState("Select mode to begin");
  const [score, setScore] = useState(null);
  const [videoSrc, setVideoSrc] = useState(null);
  const [mode, setMode] = useState('live');
  const [savingStatus, setSavingStatus] = useState(null);

  const isProcessingRef = useRef(false);
  const modeRef = useRef('live');
  
  const analysisRef = useRef({
    frames: 0,
    handPath: [],
    // New Metrics
    initialNose: null,
    maxHeadDeviation: 0,
    maxShoulderSlope: 0,
    minHandY: 1 // Start at bottom
  });

  const poseRef = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    if (window.Pose) {
      const pose = new window.Pose({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`});
      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      pose.onResults(onResults);
      poseRef.current = pose;
    }
    return () => {
      stopCamera();
      if (poseRef.current) poseRef.current.close();
    };
  }, []);

  const stopCamera = () => {
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
  };

  const startLiveCamera = () => {
    setMode('live');
    setScore(null);
    setSavingStatus(null);
    setFeedback("Position full body. Press Start.");
    
    if (videoRef.current && window.Camera) {
      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (poseRef.current) await poseRef.current.send({image: videoRef.current});
        },
        width: 640,
        height: 480
      });
      camera.start();
      cameraRef.current = camera;
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      stopCamera();
      setMode('upload');
      setScore(null);
      setSavingStatus(null);
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setFeedback("Video loaded. Press Start.");
      resetAnalysis();
      if (canvasRef.current) {
         const ctx = canvasRef.current.getContext('2d');
         ctx.clearRect(0,0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  const startRecordingStream = () => {
     if (!canvasRef.current) return;
     chunksRef.current = [];
     
     // 1. Capture the canvas stream (which includes video + overlay)
     const stream = canvasRef.current.captureStream(30); // 30 FPS
     
     // 2. Setup MediaRecorder
     let options = { mimeType: 'video/webm' };
     if (!MediaRecorder.isTypeSupported('video/webm')) {
         options = { mimeType: 'video/mp4' }; 
     }
     
     try {
       const recorder = new MediaRecorder(stream, options);
       
       recorder.ondataavailable = (e) => {
         if (e.data.size > 0) chunksRef.current.push(e.data);
       };
       
       recorder.start();
       mediaRecorderRef.current = recorder;
     } catch (e) {
       console.error("Recording not supported", e);
     }
  };

  const stopRecordingStream = () => {
     if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
     }
  };

  const toggleProcessing = () => {
    if (isProcessing) {
      // STOP
      setIsProcessing(false);
      stopRecordingStream();
      finishSession();
    } else {
      // START
      resetAnalysis();
      setIsProcessing(true);
      startRecordingStream(); // Begin recording the canvas
      
      if (mode === 'upload' && videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
        requestAnimationFrame(processUploadedVideoFrame);
      }
    }
  };

  const processUploadedVideoFrame = async () => {
    const video = videoRef.current;
    if (!video || !poseRef.current || !isProcessingRef.current) return;
    
    if (video.paused || video.ended) {
      if (video.ended) {
        setIsProcessing(false);
        stopRecordingStream();
        finishSession();
      }
      return;
    }
    await poseRef.current.send({image: video});
    requestAnimationFrame(processUploadedVideoFrame);
  };

  const resetAnalysis = () => {
    analysisRef.current = {
      frames: 0,
      handPath: [],
      initialNose: null,
      maxHeadDeviation: 0,
      maxShoulderSlope: 0,
      minHandY: 1
    };
  };

  const onResults = (results) => {
    if (!canvasRef.current) return;
    const width = 640;
    const height = 480;
    canvasRef.current.width = width;
    canvasRef.current.height = height;

    const ctx = canvasRef.current.getContext('2d');
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    
    // Draw Video Frame 
    // Important: For Recording to capture video, we MUST draw the image onto canvas
    if (modeRef.current === 'live' || modeRef.current === 'upload') {
       ctx.drawImage(results.image, 0, 0, width, height);
    }

    if (results.poseLandmarks) {
      const lm = results.poseLandmarks;
      const nose = lm[0];
      const leftShoulder = lm[11];
      const rightShoulder = lm[12];
      const leftHip = lm[23];
      const rightHip = lm[24];
      const leftWrist = lm[15];
      const rightWrist = lm[16];

      const midShoulder = getMidPoint(leftShoulder, rightShoulder);
      const midHip = getMidPoint(leftHip, rightHip);
      const midWrist = getMidPoint(leftWrist, rightWrist);

      // SKELETON
      window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS, {color: 'rgba(255, 255, 255, 0.2)', lineWidth: 1});

      // SPINE
      ctx.beginPath();
      ctx.moveTo(midShoulder.x * width, midShoulder.y * height);
      ctx.lineTo(midHip.x * width, midHip.y * height);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 4;
      ctx.stroke();

      if (isProcessingRef.current) {
         // 1. Hand Path & Extension
         if (midWrist.visibility > 0.5) {
             analysisRef.current.handPath.push({x: midWrist.x, y: midWrist.y});
             if (midWrist.y < analysisRef.current.minHandY) {
                 analysisRef.current.minHandY = midWrist.y;
             }
         }
         
         // 2. Head Stability
         if (!analysisRef.current.initialNose) {
             analysisRef.current.initialNose = {x: nose.x, y: nose.y};
         } else {
             const dx = nose.x - analysisRef.current.initialNose.x;
             const dy = nose.y - analysisRef.current.initialNose.y;
             const deviation = Math.sqrt(dx*dx + dy*dy);
             if (deviation > analysisRef.current.maxHeadDeviation) {
                 analysisRef.current.maxHeadDeviation = deviation;
             }
         }

         // 3. Rotation (Shoulder Slope)
         const slope = calculateSlope(leftShoulder, rightShoulder);
         if (slope > analysisRef.current.maxShoulderSlope) {
             analysisRef.current.maxShoulderSlope = slope;
         }
         
         analysisRef.current.frames++;
      }

      // TRACE
      const path = analysisRef.current.handPath;
      if (path.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.moveTo(path[0].x * width, path[0].y * height);
          for (let i = 1; i < path.length; i++) {
             ctx.lineTo(path[i].x * width, path[i].y * height);
          }
          ctx.stroke();
      }

      // HEAD
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      const headSize = Math.abs(leftShoulder.x - rightShoulder.x) * 0.5 * width;
      ctx.strokeRect((nose.x * width) - (headSize/2), (nose.y * height) - (headSize/2), headSize, headSize);
    }
    ctx.restore();
  };

  const finishSession = () => {
    setSavingStatus("Saving Replay...");
    
    setTimeout(async () => {
        const stats = analysisRef.current;
        
        // --- SCORING ALGORITHM ---
        const maxDev = stats.maxHeadDeviation || 0;
        let stabilityScore = Math.max(0, 100 - (maxDev * 500)); 
        
        const maxSlope = stats.maxShoulderSlope || 0;
        let rotationScore = Math.min(100, (maxSlope * 200)); 
        
        const minY = stats.minHandY || 1;
        let extensionScore = Math.max(0, (0.5 - minY) * 250); 
        
        const frames = stats.frames;
        let tempoScore = 100;
        if (frames < 20 || frames > 90) tempoScore = 50;
        
        const finalScore = Math.round(
            (stabilityScore * 0.35) + 
            (rotationScore * 0.30) + 
            (extensionScore * 0.20) + 
            (tempoScore * 0.15)
        );

        // GENERATE TEXT FEEDBACK
        let feedbackText = "Great swing! Keep practicing.";
        if (stabilityScore < 50) feedbackText = "Your head moved too much. Keep steady.";
        else if (rotationScore < 50) feedbackText = "Increase shoulder turn for more power.";
        else if (extensionScore < 50) feedbackText = "Hands are too low. Extend your arms.";
        else if (tempoScore < 80) feedbackText = "Swing was too fast or too slow.";
        
        setScore(finalScore);
        
        // SAVE VIDEO
        let videoId = null;
        if (chunksRef.current.length > 0) {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            videoId = await saveVideo(blob);
            setSavingStatus(null);
        } else {
            setSavingStatus("Error saving video");
        }

        const newSession = {
          score: finalScore,
          timestamp: new Date().toISOString(),
          type: modeRef.current,
          videoId: videoId,
          breakdown: {
             stability: stabilityScore,
             rotation: rotationScore,
             extension: extensionScore,
             tempo: tempoScore
          },
          feedbackText: feedbackText
        };

        try {
          const existing = JSON.parse(localStorage.getItem('smartSwingData') || '[]');
          const updated = [...existing, newSession].slice(-10);
          localStorage.setItem('smartSwingData', JSON.stringify(updated));
        } catch (e) {
          console.error("Storage full");
        }
        
        setFeedback("Analysis Complete");
    }, 500); 
  };

  return (
    <div className="h-full flex flex-col bg-black">
      <div className="relative flex-grow bg-slate-900 overflow-hidden flex items-center justify-center" ref={containerRef}>
        
        <video 
          ref={videoRef} 
          src={videoSrc}
          className="absolute top-0 left-0 w-full h-full object-contain hidden" 
          playsInline 
          muted
        />

        <canvas 
          ref={canvasRef} 
          className="absolute top-0 left-0 w-full h-full object-contain z-10" 
          width={640} 
          height={480} 
        />

        <div className="absolute top-4 left-4 right-4 z-30 flex justify-between">
           <div className="bg-black/60 p-2 rounded text-xs text-white backdrop-blur flex items-center border border-white/10">
              <Activity className={`w-3 h-3 mr-2 ${isProcessing ? 'text-red-500 animate-pulse' : 'text-cyan-500'}`} />
              {savingStatus || feedback}
           </div>
           
           {isProcessing && (
             <div className="flex flex-col gap-1 items-end">
                <div className="bg-black/60 px-2 py-1 rounded text-[10px] text-white flex items-center">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 mr-2"/> Spine
                </div>
                <div className="bg-black/60 px-2 py-1 rounded text-[10px] text-white flex items-center">
                    <div className="w-2 h-2 rounded-full bg-yellow-400 mr-2"/> Path
                </div>
             </div>
           )}
        </div>

        {score !== null && !isProcessing && !savingStatus && (
           <div className="absolute bottom-24 left-4 right-4 bg-slate-900/90 border border-cyan-500/50 p-4 rounded-xl backdrop-blur-md z-30 animate-in slide-in-from-bottom-10">
              <div className="flex justify-between items-center mb-4">
                 <div>
                    <div className="text-slate-400 text-xs uppercase font-bold">Session Score</div>
                    <div className="text-4xl font-black text-white">{score}</div>
                 </div>
                 <div className="text-right">
                    <div className="text-slate-400 text-xs">Replay Saved</div>
                    <div className="text-cyan-400 font-bold">Ready</div>
                 </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setScore(null); setMode(mode); if(videoRef.current) videoRef.current.currentTime=0; }} className="flex-1 bg-cyan-600 hover:bg-cyan-500 py-3 rounded-lg font-bold text-white transition-colors">
                   Retry
                </button>
                <button onClick={() => setView('home')} className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-lg font-bold text-white transition-colors">
                   Done
                </button>
              </div>
           </div>
        )}
      </div>

      <div className="bg-slate-800 p-4 pb-8 rounded-t-2xl z-30 border-t border-slate-700">
        {!isProcessing && !videoSrc && mode === 'live' && (
          <div className="grid grid-cols-2 gap-4">
             <button onClick={startLiveCamera} className="bg-cyan-600 p-4 rounded-xl flex flex-col items-center justify-center text-white hover:bg-cyan-500 transition-colors">
                <Camera className="mb-2 w-6 h-6" /> 
                <span className="text-sm font-bold">Live Camera</span>
             </button>
             <button onClick={() => fileInputRef.current.click()} className="bg-purple-600 p-4 rounded-xl flex flex-col items-center justify-center text-white hover:bg-purple-500 transition-colors">
                <Upload className="mb-2 w-6 h-6" /> 
                <span className="text-sm font-bold">Import Video</span>
             </button>
             <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="video/*" className="hidden" />
          </div>
        )}

        {(mode === 'live' || videoSrc) && score === null && (
           <div className="flex items-center justify-center gap-6">
              {videoSrc && !isProcessing && (
                  <button onClick={() => { setVideoSrc(null); setMode('live'); }} className="p-3 rounded-full bg-slate-700 text-white">
                      <RotateCcw className="w-6 h-6" />
                  </button>
              )}
              
              <button 
                onClick={toggleProcessing}
                className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all transform active:scale-95 shadow-xl ${
                    isProcessing 
                    ? 'border-red-500 bg-red-500/20' 
                    : 'border-white bg-cyan-500'
                }`}
              >
                 {isProcessing ? (
                     <div className="w-8 h-8 bg-red-500 rounded-sm" />
                 ) : (
                     mode === 'upload' ? <Play className="w-8 h-8 text-white fill-current ml-1" /> : <div className="w-16 h-16 rounded-full bg-red-500 border-4 border-white" />
                 )}
              </button>
           </div>
        )}
      </div>
    </div>
  );
};