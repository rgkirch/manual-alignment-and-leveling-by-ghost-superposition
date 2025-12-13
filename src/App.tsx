import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, RotateCw, Download, Trash2, Sliders, FlipHorizontal, FlipVertical, Eye, EyeOff, Activity, Move } from 'lucide-react';

// --- Reusable Histogram Component (Krita Style) ---
const LevelsHistogram = ({
  imageSrc,
  channelMode,
  histogram,
  setHistogram,
  blackPoint, setBlackPoint,
  whitePoint, setWhitePoint,
  midPoint, setMidPoint
}: {
  imageSrc: string | null,
  channelMode: string,
  histogram: number[],
  setHistogram: (h: number[]) => void,
  blackPoint: number, setBlackPoint: (v: number) => void,
  whitePoint: number, setWhitePoint: (v: number) => void,
  midPoint: number, setMidPoint: (v: number) => void
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState<'black' | 'white' | 'mid' | null>(null);

  // 1. Calculate Histogram
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = (300 * img.height) / img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

      const hist = new Array(256).fill(0);
       for (let i = 0; i < data.length; i += 4) {
        let val;
        if (channelMode === 'Red') {
            val = data[i];
        } else if (channelMode === 'Green') {
            val = data[i+1];
        } else if (channelMode === 'Blue') {
            val = data[i+2];
        } else { // RGB
            val = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
        }
        hist[val]++;
      }
      setHistogram(hist);
    };
  }, [imageSrc, channelMode]);

  // 2. Coordinate Helpers
  const width = 280;
  const valToX = (val: number) => (val / 255) * width;
  const xToVal = (x: number) => Math.max(0, Math.min(255, Math.round((x / width) * 255)));

  // 3. Drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const graphH = h - 25;

    ctx.clearRect(0, 0, w, h);

    // Normalize for drawing
    const max = Math.max(...histogram, 1);
    const normalizedHist = histogram.map(v => v / max);

    // Draw Histogram Bars
    ctx.fillStyle = '#6366f1'; // Indigo
    ctx.globalAlpha = 0.6;
    const barW = w / 256;
    normalizedHist.forEach((val, i) => {
      const barH = val * graphH;
      ctx.fillRect(i * barW, graphH - barH, barW, barH);
    });

    // Draw Inactive Areas (Dimmed)
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 0.7;
    const bx = valToX(blackPoint);
    const wx = valToX(whitePoint);
    const mx = valToX(midPoint);

    ctx.fillRect(0, 0, bx, graphH);
    ctx.fillRect(wx, 0, w - wx, graphH);

    // Draw Controls Baseline
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = '#525252';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, graphH);
    ctx.lineTo(w, graphH);
    ctx.stroke();

    // Helper: Draw Handle with Outline
    const drawHandle = (x: number, fillColor: string, strokeColor: string, type: 'triangle' | 'diamond') => {
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.beginPath();

      if (type === 'triangle') {
        // Bottom-pointing triangle for limits
        ctx.moveTo(x, graphH);
        ctx.lineTo(x - 7, graphH + 12);
        ctx.lineTo(x + 7, graphH + 12);
        ctx.closePath();
      } else {
        // Up-pointing triangle for midpoint (Standard Levels style)
        // Actually, let's do the classic Grey Triangle shape
        ctx.beginPath();
        ctx.moveTo(x, graphH);
        ctx.lineTo(x - 6, graphH + 12);
        ctx.lineTo(x + 6, graphH + 12);
        ctx.closePath();
      }

      ctx.fill();
      ctx.stroke();
    };

    // Black Point Handle
    drawHandle(bx, '#000000', '#ffffff', 'triangle');

    // White Point Handle
    drawHandle(wx, '#ffffff', '#000000', 'triangle');

    // Mid Point Handle
    // Only draw if valid space exists
    if (whitePoint > blackPoint + 2) {
        drawHandle(mx, '#808080', '#ffffff', 'diamond');
    }

  }, [histogram, blackPoint, whitePoint, midPoint]);

  // 4. Interaction
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const bx = valToX(blackPoint);
    const wx = valToX(whitePoint);
    const mx = valToX(midPoint);
    const hitRadius = 15;

    // Check Mid first (it's usually in the middle)
    if (Math.abs(x - mx) < hitRadius) setIsDragging('mid');
    else if (Math.abs(x - bx) < hitRadius) setIsDragging('black');
    else if (Math.abs(x - wx) < hitRadius) setIsDragging('white');
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(width, x));

    const val = xToVal(x);

    if (isDragging === 'black') {
        const limit = Math.min(midPoint - 1, whitePoint - 2);
        setBlackPoint(Math.min(val, limit));
    } else if (isDragging === 'white') {
        const limit = Math.max(midPoint + 1, blackPoint + 2);
        setWhitePoint(Math.max(val, limit));
    } else if (isDragging === 'mid') {
        // Constrained between Black and White
        const min = blackPoint + 1;
        const max = whitePoint - 1;
        setMidPoint(Math.max(min, Math.min(max, val)));
    }
  };

  return (
    <div className="bg-neutral-950 rounded border border-neutral-800 p-2 select-none">
      <canvas
        ref={canvasRef}
        width={280}
        height={120}
        className="cursor-pointer w-full touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setIsDragging(null)}
        onMouseLeave={() => setIsDragging(null)}
      />
      <div className="flex justify-between text-[10px] text-neutral-500 mt-2 px-1 font-mono">
        <span>IN: {blackPoint}</span>
        <span className="text-neutral-400">MID: {midPoint}</span>
        <span>WHITE: {whitePoint}</span>
      </div>
    </div>
  );
};


export default function SymmetryApp() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });

  // Transformation
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);

  const [channelMode, setChannelMode] = useState('RGB');
  const [levels, setLevels] = useState<{ [key: string]: { blackPoint: number; whitePoint: number; midPoint: number; outputBlackPoint: number; outputWhitePoint: number; } }>({
    RGB: { blackPoint: 0, whitePoint: 255, midPoint: 128, outputBlackPoint: 0, outputWhitePoint: 255 },
    Red: { blackPoint: 0, whitePoint: 255, midPoint: 128, outputBlackPoint: 0, outputWhitePoint: 255 },
    Green: { blackPoint: 0, whitePoint: 255, midPoint: 128, outputBlackPoint: 0, outputWhitePoint: 255 },
    Blue: { blackPoint: 0, whitePoint: 255, midPoint: 128, outputBlackPoint: 0, outputWhitePoint: 255 },
  });
  const [histogram, setHistogram] = useState<number[]>(new Array(256).fill(0));

  // Ghost
  const [showGhost, setShowGhost] = useState(true);
  const [ghostOpacity, setGhostOpacity] = useState(0.5);
  const [mirrorH, setMirrorH] = useState(true);
  const [mirrorV, setMirrorV] = useState(false);

  // Dragging
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Core Math for Levels ---
  // We need to calculate the Exponent (Gamma) that maps our custom Midpoint to 0.5
  const { rParams, gParams, bParams } = useMemo(() => {
    const calculateParams = (channelSettings: typeof levels.RGB) => {
      const { blackPoint, whitePoint, midPoint, outputBlackPoint, outputWhitePoint } = channelSettings;
      const w = whitePoint <= blackPoint ? blackPoint + 1 : whitePoint;
      const inputRange = w - blackPoint;
      const inputSlope = 255 / inputRange;
      const inputIntercept = -blackPoint * inputSlope / 255;
      let midNorm = (midPoint - blackPoint) / inputRange;
      midNorm = Math.max(0.01, Math.min(0.99, midNorm));
      const exponent = Math.log(0.5) / Math.log(midNorm);
      const outputRange = outputWhitePoint - outputBlackPoint;
      const outputSlope = outputRange / 255;
      const outputIntercept = outputBlackPoint / 255;
      return { inputSlope, inputIntercept, exponent, outputSlope, outputIntercept };
    };
    return {
      rParams: calculateParams(levels.Red),
      gParams: calculateParams(levels.Green),
      bParams: calculateParams(levels.Blue),
    };
  }, [levels]);

  // File Handler
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setOriginalDimensions({ width: img.width, height: img.height });
          setImageSrc(e.target?.result as string);
          // Reset
          setPosition({ x: 0, y: 0 });
          setRotation(0);
          setLevels({
            RGB: { blackPoint: 0, whitePoint: 255, midPoint: 128, outputBlackPoint: 0, outputWhitePoint: 255 },
            Red: { blackPoint: 0, whitePoint: 255, midPoint: 128, outputBlackPoint: 0, outputWhitePoint: 255 },
            Green: { blackPoint: 0, whitePoint: 255, midPoint: 128, outputBlackPoint: 0, outputWhitePoint: 255 },
            Blue: { blackPoint: 0, whitePoint: 255, midPoint: 128, outputBlackPoint: 0, outputWhitePoint: 255 },
          });
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Viewport Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageSrc) return;
    setIsDraggingImage(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingImage) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  // Export Logic (Exact Match to Preview)
  const handleExport = () => {
    if (!imageSrc) return;

    const img = new Image();
    img.src = imageSrc;

    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = originalDimensions.width;
    rawCanvas.height = originalDimensions.height;
    const rawCtx = rawCanvas.getContext('2d');
    if (!rawCtx) return;

    rawCtx.drawImage(img, 0, 0);
    const imageData = rawCtx.getImageData(0, 0, rawCanvas.width, rawCanvas.height);
    const data = imageData.data;

    const createProcessChannel = (params: typeof rParams) => (val: number) => {
        const c_in = val / 255.0;
        const c_after_input = c_in * params.inputSlope + params.inputIntercept;
        const c_after_gamma = Math.pow(Math.max(0.0, Math.min(1.0, c_after_input)), params.exponent);
        const c_out = c_after_gamma * params.outputSlope + params.outputIntercept;
        return Math.floor(Math.max(0.0, Math.min(1.0, c_out)) * 255);
    };

    const processR = createProcessChannel(rParams);
    const processG = createProcessChannel(gParams);
    const processB = createProcessChannel(bParams);

    for (let i = 0; i < data.length; i += 4) {
      data[i] = processR(data[i]);     // R
      data[i+1] = processG(data[i+1]); // G
      data[i+2] = processB(data[i+2]); // B
    }
    rawCtx.putImageData(imageData, 0, 0);

    // 2. Rotate & Center
    const exportCanvas = document.createElement('canvas');
    const diag = Math.sqrt(originalDimensions.width ** 2 + originalDimensions.height ** 2);
    const size = Math.ceil(diag * 1.2);
    exportCanvas.width = size;
    exportCanvas.height = size;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const cx = exportCanvas.width / 2;
    const cy = exportCanvas.height / 2;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(position.x, position.y);
    ctx.drawImage(rawCanvas, -originalDimensions.width / 2, -originalDimensions.height / 2);
    ctx.restore();

    const link = document.createElement('a');
    link.download = 'aligned-fusion-ready.png';
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  const handleAutoLevels = () => {
    if (!histogram || histogram.length === 0) return;

    const totalPixels = histogram.reduce((a, b) => a + b, 0);
    if (totalPixels === 0) return;

    const threshold = 0.001;
    const thresholdPixels = totalPixels * threshold;

    let black = 0;
    let white = 255;

    // Find black point
    let cumulative = 0;
    for (let i = 0; i < 256; i++) {
        cumulative += histogram[i];
        if (cumulative >= thresholdPixels) {
            black = i;
            break;
        }
    }

    // Find white point
    cumulative = 0;
    for (let i = 255; i >= 0; i--) {
        cumulative += histogram[i];
        if (cumulative >= thresholdPixels) {
            white = i;
            break;
        }
    }
    
    // Ensure black is less than white
    if (black >= white) {
        black = 0;
        white = 255;
    }

    setLevels(p => {
        const newP = { ...p };
        const applyPoints = (channel: string) => {
            newP[channel].blackPoint = black;
            newP[channel].whitePoint = white;
        }
        
        if (channelMode === 'RGB') {
            applyPoints('RGB');
            applyPoints('Red');
            applyPoints('Green');
            applyPoints('Blue');
        } else {
            applyPoints(channelMode);
        }
        return newP;
    });
  };

  return (
    <div className="flex h-screen bg-neutral-900 text-white font-sans overflow-hidden select-none"
         onMouseMove={handleMouseMove}
         onMouseUp={() => setIsDraggingImage(false)}
         onMouseLeave={() => setIsDraggingImage(false)}
    >
      {/* SVG Filters for Live Preview */}
      <svg width="0" height="0" className="absolute pointer-events-none">
        <defs>
          <filter id="levels-complex">
             {/* Step 1: Linear Stretch (Input Black/White Points) */}
             <feComponentTransfer>
                <feFuncR type="linear" slope={rParams.inputSlope} intercept={rParams.inputIntercept} />
                <feFuncG type="linear" slope={gParams.inputSlope} intercept={gParams.inputIntercept} />
                <feFuncB type="linear" slope={bParams.inputSlope} intercept={bParams.inputIntercept} />
             </feComponentTransfer>
             {/* Step 2: Gamma Correction (Midtone shift) */}
             <feComponentTransfer>
                <feFuncR type="gamma" exponent={rParams.exponent} />
                <feFuncG type="gamma" exponent={gParams.exponent} />
                <feFuncB type="gamma" exponent={bParams.exponent} />
             </feComponentTransfer>
             {/* Step 3: Linear Scale (Output Black/White Points) */}
            <feComponentTransfer>
                <feFuncR type="linear" slope={rParams.outputSlope} intercept={rParams.outputIntercept} />
                <feFuncG type="linear" slope={gParams.outputSlope} intercept={gParams.outputIntercept} />
                <feFuncB type="linear" slope={bParams.outputSlope} intercept={bParams.outputIntercept} />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>

      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 bg-neutral-800 border-r border-neutral-700 p-4 flex flex-col gap-6 overflow-y-auto z-10 shadow-xl scrollbar-thin scrollbar-thumb-neutral-600">
        <h1 className="text-xl font-bold flex items-center gap-2 text-indigo-400">
          <Sliders size={24} />
          Symmetry Align
        </h1>

        {!imageSrc ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="h-24 border-2 border-dashed border-neutral-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-neutral-700 transition"
          >
            <Upload className="mb-2 text-neutral-400" size={20}/>
            <span className="text-xs text-neutral-400">Upload Image</span>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
          </div>
        ) : (
          <button onClick={() => setImageSrc(null)} className="bg-red-900/50 hover:bg-red-900 text-red-200 py-2 rounded text-xs flex items-center justify-center gap-2">
            <Trash2 size={14} /> Reset
          </button>
        )}

        {/* --- Krita Style Levels --- */}
        {imageSrc && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase text-neutral-400 tracking-wider flex items-center gap-2">
                <Activity size={14} /> Levels
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAutoLevels}
                  className="bg-neutral-700 hover:bg-neutral-600 text-neutral-300 text-xs rounded px-2 py-1 transition-colors"
                >
                  Auto
                </button>
                <select
                    value={channelMode}
                    onChange={(e) => setChannelMode(e.target.value)}
                    className="bg-neutral-900 border border-neutral-700 text-neutral-300 text-xs rounded px-2 py-1"
                >
                    <option value="RGB">RGB</option>
                    <option value="Red">Red</option>
                    <option value="Green">Green</option>
                    <option value="Blue">Blue</option>
                </select>
              </div>
            </div>
            <LevelsHistogram
              imageSrc={imageSrc}
              channelMode={channelMode}
              histogram={histogram}
              setHistogram={setHistogram}
              blackPoint={levels[channelMode].blackPoint}
              setBlackPoint={(v) => setLevels(p => {
                const newP = { ...p };
                if (channelMode === 'RGB') {
                  newP.RGB.blackPoint = v; newP.Red.blackPoint = v; newP.Green.blackPoint = v; newP.Blue.blackPoint = v;
                } else {
                  newP[channelMode].blackPoint = v;
                }
                return newP;
              })}
              whitePoint={levels[channelMode].whitePoint}
              setWhitePoint={(v) => setLevels(p => {
                const newP = { ...p };
                if (channelMode === 'RGB') {
                  newP.RGB.whitePoint = v; newP.Red.whitePoint = v; newP.Green.whitePoint = v; newP.Blue.whitePoint = v;
                } else {
                  newP[channelMode].whitePoint = v;
                }
                return newP;
              })}
              midPoint={levels[channelMode].midPoint}
              setMidPoint={(v) => setLevels(p => {
                const newP = { ...p };
                if (channelMode === 'RGB') {
                  newP.RGB.midPoint = v; newP.Red.midPoint = v; newP.Green.midPoint = v; newP.Blue.midPoint = v;
                } else {
                  newP[channelMode].midPoint = v;
                }
                return newP;
              })}
            />
            <div className="text-[10px] text-neutral-500 mt-2 px-1 font-mono space-y-2">
              <div className="flex justify-between">
                <label>Output Black: {levels[channelMode].outputBlackPoint}</label>
                <label>Output White: {levels[channelMode].outputWhitePoint}</label>
              </div>
              <div className="relative h-4">
                  <input
                      type="range" min="0" max="255"
                      value={levels[channelMode].outputBlackPoint}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        setLevels(p => {
                          const newP = { ...p };
                          const newBlack = Math.min(value, newP[channelMode].outputWhitePoint - 1);
                          if (channelMode === 'RGB') {
                            newP.RGB.outputBlackPoint = newBlack; newP.Red.outputBlackPoint = newBlack; newP.Green.outputBlackPoint = newBlack; newP.Blue.outputBlackPoint = newBlack;
                          } else {
                            newP[channelMode].outputBlackPoint = newBlack;
                          }
                          return newP;
                        })
                      }}
                      className="absolute w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-gray-400 z-10"
                      style={{ background: 'transparent' }}
                  />
                   <input
                      type="range" min="0" max="255"
                      value={levels[channelMode].outputWhitePoint}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        setLevels(p => {
                          const newP = { ...p };
                          const newWhite = Math.max(value, newP[channelMode].outputBlackPoint + 1);
                           if (channelMode === 'RGB') {
                            newP.RGB.outputWhitePoint = newWhite; newP.Red.outputWhitePoint = newWhite; newP.Green.outputWhitePoint = newWhite; newP.Blue.outputWhitePoint = newWhite;
                          } else {
                            newP[channelMode].outputWhitePoint = newWhite;
                          }
                          return newP;
                        })
                      }}
                      className="absolute w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-white"
                  />
              </div>
            </div>
            <p className="text-[10px] text-neutral-500 italic leading-snug">
               Tip: Drag Black triangle just past the first peak. Drag Grey triangle left to expand shadow detail.
            </p>
          </div>
        )}

        <hr className="border-neutral-700" />

        {/* Rotation & Position */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-xs font-bold uppercase text-neutral-500 tracking-wider flex items-center gap-2">
                <RotateCw size={14} /> Rotation
              </label>
              <span className="text-xs font-mono text-indigo-300">{rotation.toFixed(2)}°</span>
            </div>
            <input
              type="range" min="-180" max="180" step="0.05"
              value={rotation}
              onChange={(e) => setRotation(parseFloat(e.target.value))}
              className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex gap-2">
               <button onClick={() => setRotation(r => r - 0.1)} className="flex-1 bg-neutral-700 text-[10px] py-1 rounded hover:bg-neutral-600">-0.1°</button>
               <button onClick={() => setRotation(0)} className="flex-1 bg-neutral-700 text-[10px] py-1 rounded hover:bg-neutral-600">0°</button>
               <button onClick={() => setRotation(r => r + 0.1)} className="flex-1 bg-neutral-700 text-[10px] py-1 rounded hover:bg-neutral-600">+0.1°</button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-neutral-500 tracking-wider flex items-center gap-2">
               <Move size={14} /> Position (Pixels)
            </label>
            <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-neutral-500">X Offset</span>
                    <input type="number" value={position.x} onChange={(e) => setPosition(p => ({...p, x: parseInt(e.target.value) || 0}))} className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono" />
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-neutral-500">Y Offset</span>
                    <input type="number" value={position.y} onChange={(e) => setPosition(p => ({...p, y: parseInt(e.target.value) || 0}))} className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono" />
                </div>
            </div>
          </div>
        </div>

        <hr className="border-neutral-700" />

        {/* Ghost Settings */}
        <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase text-neutral-500 tracking-wider">Ghost Overlay</label>
              <button onClick={() => setShowGhost(!showGhost)} className={`p-1 rounded ${showGhost ? 'bg-indigo-600 text-white' : 'bg-neutral-700 text-neutral-400'}`}>
                {showGhost ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
            {showGhost && (
              <>
                <div className="space-y-1">
                  <span className="text-[10px] text-neutral-400">Opacity</span>
                  <input type="range" min="0" max="1" step="0.05" value={ghostOpacity} onChange={(e) => setGhostOpacity(parseFloat(e.target.value))} className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-teal-500" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setMirrorH(!mirrorH)} className={`flex items-center justify-center gap-2 py-2 text-xs rounded border ${mirrorH ? 'bg-teal-900/30 border-teal-500 text-teal-200' : 'bg-neutral-800 border-neutral-600 text-neutral-400'}`}>
                    <FlipHorizontal size={14} /> Mirror Horiz
                  </button>
                  <button onClick={() => setMirrorV(!mirrorV)} className={`flex items-center justify-center gap-2 py-2 text-xs rounded border ${mirrorV ? 'bg-teal-900/30 border-teal-500 text-teal-200' : 'bg-neutral-800 border-neutral-600 text-neutral-400'}`}>
                    <FlipVertical size={14} /> Mirror Vert
                  </button>
                </div>
              </>
            )}
        </div>

        <div className="mt-auto pt-6 border-t border-neutral-700">
           <button onClick={handleExport} disabled={!imageSrc} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition">
             <Download size={18} /> Download
           </button>
        </div>
      </div>

      {/* Viewport */}
      <div
        className="flex-1 relative bg-[#1a1a1a] overflow-hidden cursor-move"
        onMouseDown={handleMouseDown}
        style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '20px 20px' }}
      >
        {!imageSrc && (
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-neutral-600 text-center">
                 <p className="text-lg font-medium">Drag & Drop Image Here</p>
                 <p className="text-sm">Use the Histogram to isolate your object</p>
              </div>
           </div>
        )}

        <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
           <div className="w-full h-[1px] bg-green-500/50 shadow-[0_0_2px_rgba(0,255,0,0.8)]"></div>
           <div className="h-full w-[1px] bg-green-500/50 shadow-[0_0_2px_rgba(0,255,0,0.8)] absolute"></div>
           <div className="w-2 h-2 bg-green-400 rounded-full shadow-[0_0_4px_rgba(0,255,0,1)] absolute"></div>
        </div>

        {imageSrc && (
          <div className="absolute inset-0 flex items-center justify-center overflow-visible pointer-events-none">
             <div className="relative w-0 h-0 flex items-center justify-center">
                {showGhost && (
                    <div className="absolute w-0 h-0 flex items-center justify-center pointer-events-none mix-blend-difference"
                        style={{ transform: `scaleX(${mirrorH ? -1 : 1}) scaleY(${mirrorV ? -1 : 1})`, zIndex: 20 }}>
                         <img src={imageSrc} alt="Ghost" style={{
                                transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg)`,
                                opacity: ghostOpacity, maxWidth: 'none',
                                filter: `url(#levels-complex) grayscale(100%) invert(1)`
                            }} draggable={false} />
                    </div>
                )}
                <div className="absolute w-0 h-0 flex items-center justify-center" style={{ zIndex: 10 }}>
                    <img src={imageSrc} alt="Main" style={{
                            transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg)`,
                            maxWidth: 'none', filter: `url(#levels-complex)`
                        }} draggable={false} />
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
