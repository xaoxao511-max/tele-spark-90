import React, { useEffect, useRef, useState } from 'react';
import { X, RotateCw, Crop, Pencil, Check, Undo2, Eraser } from 'lucide-react';
import { motion } from 'framer-motion';

interface ImageEditorProps {
  src: string;
  onCancel: () => void;
  onDone: (file: File) => void;
}

type Mode = 'idle' | 'crop' | 'draw';

interface Stroke { points: { x: number; y: number }[]; color: string; size: number; }
interface CropRect { x: number; y: number; w: number; h: number; }

const COLORS = ['#ef4444', '#fbbf24', '#22c55e', '#3b82f6', '#a855f7', '#ffffff', '#000000'];

const ImageEditor: React.FC<ImageEditorProps> = ({ src, onCancel, onDone }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState(0); // multiples of 90
  const [mode, setMode] = useState<Mode>('idle');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(4);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [cropDrag, setCropDrag] = useState<{ startX: number; startY: number } | null>(null);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImgEl(img);
    img.src = src;
  }, [src]);

  // Compute display size based on container & rotation
  useEffect(() => {
    if (!imgEl || !containerRef.current) return;
    const rotated = rotation % 180 !== 0;
    const naturalW = rotated ? imgEl.naturalHeight : imgEl.naturalWidth;
    const naturalH = rotated ? imgEl.naturalWidth : imgEl.naturalHeight;
    const cw = containerRef.current.clientWidth - 32;
    const ch = containerRef.current.clientHeight - 32;
    const ratio = Math.min(cw / naturalW, ch / naturalH, 1);
    setDisplaySize({ w: naturalW * ratio, h: naturalH * ratio });
  }, [imgEl, rotation]);

  // Draw on canvas
  useEffect(() => {
    if (!imgEl || !canvasRef.current || displaySize.w === 0) return;
    const canvas = canvasRef.current;
    canvas.width = displaySize.w;
    canvas.height = displaySize.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw rotated image
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    const rotated = rotation % 180 !== 0;
    const dw = rotated ? canvas.height : canvas.width;
    const dh = rotated ? canvas.width : canvas.height;
    ctx.drawImage(imgEl, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    // Draw strokes
    const drawStroke = (s: Stroke) => {
      if (s.points.length < 1) return;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      s.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    };
    strokes.forEach(drawStroke);
    if (currentStroke) drawStroke(currentStroke);

    // Draw crop overlay
    if (crop) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, canvas.width, crop.y);
      ctx.fillRect(0, crop.y + crop.h, canvas.width, canvas.height - crop.y - crop.h);
      ctx.fillRect(0, crop.y, crop.x, crop.h);
      ctx.fillRect(crop.x + crop.w, crop.y, canvas.width - crop.x - crop.w, crop.h);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
      ctx.setLineDash([]);
    }
  }, [imgEl, displaySize, rotation, strokes, currentStroke, crop]);

  const getPos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (mode === 'draw') {
      const p = getPos(e);
      setCurrentStroke({ points: [p], color, size: brushSize });
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    } else if (mode === 'crop') {
      const p = getPos(e);
      setCropDrag({ startX: p.x, startY: p.y });
      setCrop({ x: p.x, y: p.y, w: 0, h: 0 });
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (mode === 'draw' && currentStroke) {
      const p = getPos(e);
      setCurrentStroke({ ...currentStroke, points: [...currentStroke.points, p] });
    } else if (mode === 'crop' && cropDrag) {
      const p = getPos(e);
      setCrop({
        x: Math.min(cropDrag.startX, p.x),
        y: Math.min(cropDrag.startY, p.y),
        w: Math.abs(p.x - cropDrag.startX),
        h: Math.abs(p.y - cropDrag.startY),
      });
    }
  };

  const handlePointerUp = () => {
    if (mode === 'draw' && currentStroke) {
      setStrokes(prev => [...prev, currentStroke]);
      setCurrentStroke(null);
    } else if (mode === 'crop') {
      setCropDrag(null);
    }
  };

  const handleRotate = () => setRotation(r => (r + 90) % 360);
  const handleUndo = () => setStrokes(prev => prev.slice(0, -1));
  const handleClear = () => { setStrokes([]); setCrop(null); };

  const handleSave = async () => {
    if (!canvasRef.current) return;
    // Render final at higher quality without crop overlay
    const finalCanvas = document.createElement('canvas');
    const rotated = rotation % 180 !== 0;
    const naturalW = rotated ? imgEl!.naturalHeight : imgEl!.naturalWidth;
    const naturalH = rotated ? imgEl!.naturalWidth : imgEl!.naturalHeight;
    finalCanvas.width = naturalW;
    finalCanvas.height = naturalH;
    const fctx = finalCanvas.getContext('2d')!;

    fctx.save();
    fctx.translate(finalCanvas.width / 2, finalCanvas.height / 2);
    fctx.rotate((rotation * Math.PI) / 180);
    const dw = rotated ? finalCanvas.height : finalCanvas.width;
    const dh = rotated ? finalCanvas.width : finalCanvas.height;
    fctx.drawImage(imgEl!, -dw / 2, -dh / 2, dw, dh);
    fctx.restore();

    // Scale strokes to final size
    const scale = naturalW / displaySize.w;
    strokes.forEach(s => {
      if (s.points.length < 1) return;
      fctx.strokeStyle = s.color;
      fctx.lineWidth = s.size * scale;
      fctx.lineCap = 'round';
      fctx.lineJoin = 'round';
      fctx.beginPath();
      fctx.moveTo(s.points[0].x * scale, s.points[0].y * scale);
      s.points.forEach(p => fctx.lineTo(p.x * scale, p.y * scale));
      fctx.stroke();
    });

    // Apply crop
    let outCanvas = finalCanvas;
    if (crop && crop.w > 10 && crop.h > 10) {
      const cropped = document.createElement('canvas');
      cropped.width = crop.w * scale;
      cropped.height = crop.h * scale;
      cropped.getContext('2d')!.drawImage(
        finalCanvas,
        crop.x * scale, crop.y * scale, crop.w * scale, crop.h * scale,
        0, 0, cropped.width, cropped.height
      );
      outCanvas = cropped;
    }

    outCanvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `edited_${Date.now()}.png`, { type: 'image/png' });
      onDone(file);
    }, 'image/png');
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/95 flex flex-col" onClick={e => e.stopPropagation()}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-white/10 text-white">
          <X className="h-5 w-5" />
        </button>
        <h3 className="text-white font-medium">Chỉnh sửa ảnh</h3>
        <button onClick={handleSave} className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 flex items-center gap-1.5">
          <Check className="h-4 w-4" /> Xong
        </button>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden p-4">
        {imgEl && (
          <motion.canvas
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            ref={canvasRef}
            className="rounded-lg shadow-2xl touch-none"
            style={{ cursor: mode === 'draw' ? 'crosshair' : mode === 'crop' ? 'crosshair' : 'default' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        )}
      </div>

      {/* Color/size picker (when drawing) */}
      {mode === 'draw' && (
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="px-4 py-2 border-t border-white/10 flex items-center gap-3 justify-center flex-wrap">
          <div className="flex gap-1.5">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${color === c ? 'border-white scale-110' : 'border-white/30'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-xs">Cỡ</span>
            <input
              type="range" min={2} max={20} value={brushSize}
              onChange={e => setBrushSize(Number(e.target.value))}
              className="w-24 accent-primary"
            />
          </div>
        </motion.div>
      )}

      {/* Bottom toolbar */}
      <div className="flex items-center justify-around px-4 py-3 border-t border-white/10 bg-black/50">
        <ToolBtn active={mode === 'draw'} onClick={() => setMode(mode === 'draw' ? 'idle' : 'draw')} icon={<Pencil className="h-5 w-5" />} label="Vẽ" />
        <ToolBtn active={mode === 'crop'} onClick={() => setMode(mode === 'crop' ? 'idle' : 'crop')} icon={<Crop className="h-5 w-5" />} label="Cắt" />
        <ToolBtn onClick={handleRotate} icon={<RotateCw className="h-5 w-5" />} label="Xoay" />
        <ToolBtn onClick={handleUndo} icon={<Undo2 className="h-5 w-5" />} label="Hoàn tác" disabled={strokes.length === 0} />
        <ToolBtn onClick={handleClear} icon={<Eraser className="h-5 w-5" />} label="Xoá hết" />
      </div>
    </div>
  );
};

const ToolBtn: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; disabled?: boolean }> = ({ icon, label, onClick, active, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-30 ${active ? 'bg-primary text-primary-foreground' : 'text-white hover:bg-white/10'}`}
  >
    {icon}
    <span className="text-[10px]">{label}</span>
  </button>
);

export default ImageEditor;
