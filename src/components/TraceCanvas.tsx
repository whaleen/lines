import * as ContextMenu from "@radix-ui/react-context-menu";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { pointsToPathData } from "../lib/path-data";
import { useEditorStore, pathBounds } from "../store/editor-store";
import type { Point } from "../types/lines";

type CropHandleDrag = {
  handle: "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br";
  startX: number; startY: number;
  origRect: { x: number; y: number; w: number; h: number };
};

type PointDragState = { pathId: string; pointIndex: number };
type PathDragState = { startX: number; startY: number; originals: { pathId: string; points: Point[] }[] };
type PanState = { originX: number; originY: number; startX: number; startY: number };
type ImageDragState = { startSvgX: number; startSvgY: number; origX: number; origY: number };
type RubberBand = { x1: number; y1: number; x2: number; y2: number };

const FREEHAND_THRESHOLD = 4;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function dist(a: Point, b: Point) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

type TraceCanvasProps = { imageOpacity?: number };

export function TraceCanvas({ imageOpacity = 0.78 }: TraceCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [pointDragState, setPointDragState] = useState<PointDragState | null>(null);
  const [pathDragState, setPathDragState] = useState<PathDragState | null>(null);
  const [imageDragState, setImageDragState] = useState<ImageDragState | null>(null);
  const [rubberBand, setRubberBand] = useState<RubberBand | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastDrawPoint = useRef<Point | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [cropHandleDrag, setCropHandleDrag] = useState<CropHandleDrag | null>(null);

  const {
    activeLayerId,
    activePathId,
    activeTool,
    addPointAt,
    cropCanvas,
    deleteSelectedPath,
    deselectAll,
    document,
    duplicateSelectedPaths,
    finishActivePath,
    referenceImageUrl,
    selectPath,
    selectPoint,
    selectedPathId,
    selectedPathIds,
    selectedPointIndex,
    setActiveTool,
    setImageTransform,
    setPathPoints,
    updatePoint,
  } = useEditorStore(
    useShallow((state) => ({
      activeLayerId: state.activeLayerId,
      activePathId: state.activePathId,
      activeTool: state.activeTool,
      addPointAt: state.addPointAt,
      cropCanvas: state.cropCanvas,
      deleteSelectedPath: state.deleteSelectedPath,
      deselectAll: state.deselectAll,
      document: state.document,
      duplicateSelectedPaths: state.duplicateSelectedPaths,
      finishActivePath: state.finishActivePath,
      referenceImageUrl: state.referenceImageUrl,
      selectPath: state.selectPath,
      selectPoint: state.selectPoint,
      selectedPathId: state.selectedPathId,
      selectedPathIds: state.selectedPathIds,
      selectedPointIndex: state.selectedPointIndex,
      setActiveTool: state.setActiveTool,
      setImageTransform: state.setImageTransform,
      setPathPoints: state.setPathPoints,
      updatePoint: state.updatePoint,
    })),
  );

  const canvasW = document.canvas.width;
  const canvasH = document.canvas.height;

  // Reset viewport when canvas size changes
  useEffect(() => {
    setViewport({ x: 0, y: 0, zoom: 1 });
  }, [canvasW, canvasH]);

  // Initialize / clear crop rect when switching to/from crop tool
  useEffect(() => {
    if (activeTool === "crop") {
      setCropRect({ x: 0, y: 0, w: canvasW, h: canvasH });
    } else {
      setCropRect(null);
      setCropHandleDrag(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]);

  // Keyboard: modifiers + zoom shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); setIsSpacePressed(true); }
      if (e.key === "Alt") { e.preventDefault(); setIsAltPressed(true); }
      // Crop tool shortcuts
      if (activeTool === "crop") {
        if (e.key === "Enter") {
          e.preventDefault();
          setCropRect((cr) => { if (cr) cropCanvas(cr.x, cr.y, cr.w, cr.h); return cr; });
          return;
        }
        if (e.key === "Escape") { e.preventDefault(); setActiveTool("select"); return; }
      }
      // Zoom shortcuts
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        setViewport((v) => ({ ...v, zoom: clamp(v.zoom * 1.25, 0.1, 32) }));
      }
      if (cmd && e.key === "-") {
        e.preventDefault();
        setViewport((v) => ({ ...v, zoom: clamp(v.zoom / 1.25, 0.1, 32) }));
      }
      if (cmd && e.key === "0") {
        e.preventDefault();
        setViewport({ x: 0, y: 0, zoom: 1 });
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setIsSpacePressed(false);
      if (e.key === "Alt") setIsAltPressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [activeTool, cropCanvas, setActiveTool]);

  const viewBoxWidth = canvasW / viewport.zoom;
  const viewBoxHeight = canvasH / viewport.zoom;
  const maxX = Math.max(0, canvasW - viewBoxWidth);
  const maxY = Math.max(0, canvasH - viewBoxHeight);
  const viewBoxX = clamp(viewport.x, 0, maxX);
  const viewBoxY = clamp(viewport.y, 0, maxY);

  const svgToCanvas = (clientX: number, clientY: number): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const r = pt.matrixTransform(ctm.inverse());
    return { x: r.x, y: r.y };
  };

  const svgToCanvasRef = useRef(svgToCanvas);
  svgToCanvasRef.current = svgToCanvas;

  // Active layer (for locked/visibility checks)
  const activeLayer = document.layers.find((l) => l.id === activeLayerId);

  // Window-level pointer move / up
  useEffect(() => {
    if (!pointDragState && !pathDragState && !panState && !isDrawing && !imageDragState && !rubberBand && !cropHandleDrag) return;

    const handlePointerMove = (e: PointerEvent) => {
      const { x: cx, y: cy } = svgToCanvasRef.current(e.clientX, e.clientY);

      if (pointDragState) {
        updatePoint(pointDragState.pathId, pointDragState.pointIndex, {
          x: clamp(cx, 0, canvasW), y: clamp(cy, 0, canvasH),
        });
      }

      if (pathDragState) {
        const dx = cx - pathDragState.startX;
        const dy = cy - pathDragState.startY;
        for (const { pathId, points } of pathDragState.originals) {
          setPathPoints(pathId, points.map((p) => ({ x: p.x + dx, y: p.y + dy })));
        }
      }

      if (panState) {
        const cur = svgToCanvasRef.current(e.clientX, e.clientY);
        const origin = svgToCanvasRef.current(panState.startX, panState.startY);
        setViewport((v) => ({
          ...v,
          x: clamp(panState.originX - (cur.x - origin.x), 0, maxX),
          y: clamp(panState.originY - (cur.y - origin.y), 0, maxY),
        }));
      }

      if (imageDragState) {
        const dx = cx - imageDragState.startSvgX;
        const dy = cy - imageDragState.startSvgY;
        setImageTransform(imageDragState.origX + dx, imageDragState.origY + dy, document.sourceImage.scale);
      }

      if (isDrawing) {
        const pt = svgToCanvasRef.current(e.clientX, e.clientY);
        const clamped = { x: clamp(pt.x, 0, canvasW), y: clamp(pt.y, 0, canvasH) };
        if (!lastDrawPoint.current || dist(lastDrawPoint.current, clamped) >= FREEHAND_THRESHOLD) {
          addPointAt(clamped);
          lastDrawPoint.current = clamped;
        }
      }

      if (rubberBand) {
        setRubberBand((rb) => rb ? { ...rb, x2: cx, y2: cy } : null);
      }

      if (cropHandleDrag) {
        const { handle, startX, startY, origRect } = cropHandleDrag;
        const dx = cx - startX;
        const dy = cy - startY;
        const r = { ...origRect };
        if (handle[0] === "t") {
          const newY = clamp(origRect.y + dy, 0, origRect.y + origRect.h - 10);
          r.h = origRect.h - (newY - origRect.y);
          r.y = newY;
        }
        if (handle[0] === "b") {
          r.h = clamp(origRect.h + dy, 10, canvasH - origRect.y);
        }
        if (handle[1] === "l") {
          const newX = clamp(origRect.x + dx, 0, origRect.x + origRect.w - 10);
          r.w = origRect.w - (newX - origRect.x);
          r.x = newX;
        }
        if (handle[1] === "r") {
          r.w = clamp(origRect.w + dx, 10, canvasW - origRect.x);
        }
        setCropRect(r);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (isDrawing) {
        finishActivePath();
        setIsDrawing(false);
        lastDrawPoint.current = null;
      }
      if (rubberBand) {
        // Select paths whose bounds intersect the rubber band
        const rb = rubberBand;
        const rx1 = Math.min(rb.x1, rb.x2), rx2 = Math.max(rb.x1, rb.x2);
        const ry1 = Math.min(rb.y1, rb.y2), ry2 = Math.max(rb.y1, rb.y2);
        if (rx2 - rx1 > 4 || ry2 - ry1 > 4) {
          const matched: string[] = [];
          for (const layer of document.layers) {
            if (!layer.visible || layer.locked) continue;
            for (const path of layer.paths) {
              const b = pathBounds(path.points);
              if (!b) continue;
              if (b.r >= rx1 && b.x <= rx2 && b.b >= ry1 && b.y <= ry2) matched.push(path.id);
            }
          }
          if (matched.length > 0) {
            useEditorStore.setState({
              selectedPathId: matched[matched.length - 1],
              selectedPathIds: matched,
              selectedPointIndex: null,
            });
          } else {
            deselectAll();
          }
        }
        setRubberBand(null);
      }
      setPointDragState(null);
      setPathDragState(null);
      setPanState(null);
      setImageDragState(null);
      setCropHandleDrag(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    addPointAt, canvasW, canvasH, cropHandleDrag, deselectAll, document,
    finishActivePath, imageDragState, isDrawing,
    maxX, maxY, panState, pathDragState, pointDragState,
    rubberBand, setImageTransform, setPathPoints, updatePoint,
  ]);

  const handleCanvasPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (activeTool === "crop") return;
    if (isAltPressed && referenceImageUrl) {
      const { x, y } = svgToCanvasRef.current(e.clientX, e.clientY);
      setImageDragState({ startSvgX: x, startSvgY: y, origX: document.sourceImage.x, origY: document.sourceImage.y });
      e.preventDefault(); return;
    }
    if (isSpacePressed || e.button === 1) {
      setPanState({ originX: viewBoxX, originY: viewBoxY, startX: e.clientX, startY: e.clientY });
      e.preventDefault(); return;
    }
    if (activeTool === "draw") {
      if (activeLayer?.locked) return;
      const pt = svgToCanvasRef.current(e.clientX, e.clientY);
      const clamped = { x: clamp(pt.x, 0, canvasW), y: clamp(pt.y, 0, canvasH) };
      addPointAt(clamped);
      lastDrawPoint.current = clamped;
      setIsDrawing(true);
    } else if (activeTool === "select") {
      // Start rubber-band on background click
      const { x, y } = svgToCanvasRef.current(e.clientX, e.clientY);
      setRubberBand({ x1: x, y1: y, x2: x, y2: y });
      deselectAll();
    } else {
      deselectAll();
    }
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (isAltPressed && referenceImageUrl) {
      const point = svgToCanvasRef.current(e.clientX, e.clientY);
      const curScale = document.sourceImage.scale;
      const newScale = clamp(curScale * (e.deltaY > 0 ? 0.95 : 1.05), 0.05, 20);
      const ratio = newScale / curScale;
      setImageTransform(
        point.x - (point.x - document.sourceImage.x) * ratio,
        point.y - (point.y - document.sourceImage.y) * ratio,
        newScale,
      );
      return;
    }
    const point = svgToCanvasRef.current(e.clientX, e.clientY);
    setViewport((cur) => {
      const nextZoom = clamp(cur.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.25, 12);
      const nw = canvasW / nextZoom, nh = canvasH / nextZoom;
      const cw = canvasW / cur.zoom, ch = canvasH / cur.zoom;
      const cx = clamp(cur.x, 0, Math.max(0, canvasW - cw));
      const cy = clamp(cur.y, 0, Math.max(0, canvasH - ch));
      return {
        x: clamp(point.x - ((point.x - cx) / cw) * nw, 0, Math.max(0, canvasW - nw)),
        y: clamp(point.y - ((point.y - cy) / ch) * nh, 0, Math.max(0, canvasH - nh)),
        zoom: nextZoom,
      };
    });
  };

  const svgCursor =
    isAltPressed && referenceImageUrl ? "move" :
    isSpacePressed || panState ? "grab" :
    activeTool === "draw" ? "crosshair" :
    activeTool === "crop" ? "default" : "default";

  const imgW = document.sourceImage.width * document.sourceImage.scale;
  const imgH = document.sourceImage.height * document.sourceImage.scale;

  // Render layers in reverse order (layers[0] = topmost = rendered last)
  const layersToRender = [...document.layers].reverse();

  return (
    <ContextMenu.Root>
    <ContextMenu.Trigger asChild>
    <div className="canvas-frame">
      <svg
        className="canvas-svg"
        style={{ cursor: svgCursor }}
        onPointerDown={handleCanvasPointerDown}
        onWheel={handleWheel}
        ref={svgRef}
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
      >
        {/* Canvas background */}
        <rect style={{ fill: 'var(--lines-canvas-fill)' }} height={canvasH} width={canvasW} pointerEvents="none" />

        {/* Reference image */}
        {referenceImageUrl && (
          <image
            x={document.sourceImage.x}
            y={document.sourceImage.y}
            width={imgW}
            height={imgH}
            href={referenceImageUrl}
            opacity={imageOpacity}
            pointerEvents="none"
            preserveAspectRatio="none"
          />
        )}

        {/* Layers */}
        {layersToRender.map((layer) => {
          if (!layer.visible) return null;
          return (
            <g
              key={layer.id}
              opacity={layer.opacity < 1 ? layer.opacity : undefined}
              style={layer.blendMode !== "normal" ? { mixBlendMode: layer.blendMode } : undefined}
            >
              {layer.paths.map((path) => {
                const isSelected = selectedPathIds.includes(path.id);
                const isPrimary = path.id === selectedPathId;
                const d = pointsToPathData(path.points, path.closed);
                const showHandles = activeTool === "node" && isPrimary;
                const isLocked = layer.locked;
                const pathCursor =
                  isLocked ? "default" :
                  activeTool === "draw" ? "crosshair" :
                  activeTool === "select" ? "move" : "pointer";

                return (
                  <g key={path.id} opacity={path.opacity < 1 ? path.opacity : undefined}>
                    {/* Selection highlight */}
                    {isSelected && activeTool === "select" && (
                      <path
                        d={d}
                        fill="none"
                        pointerEvents="none"
                        style={{ stroke: isPrimary ? 'var(--lines-sel-primary)' : 'var(--lines-sel-secondary)' }}
                        strokeWidth={path.strokeWidth + 6}
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                    {/* Hit target */}
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={Math.max(16, path.strokeWidth + 8)}
                      style={{ cursor: pathCursor }}
                      onPointerDown={(e) => {
                        if (activeTool === "draw" || isLocked) return;
                        e.stopPropagation();
                        selectPath(path.id, e.shiftKey);
                        if (activeTool === "select" && !e.shiftKey) {
                          const { x: cx, y: cy } = svgToCanvasRef.current(e.clientX, e.clientY);
                          const dragIds = selectedPathIds.includes(path.id) ? selectedPathIds : [path.id];
                          const originals = layersToRender
                            .flatMap((l) => l.paths)
                            .filter((p) => dragIds.includes(p.id))
                            .map((p) => ({ pathId: p.id, points: [...p.points] }));
                          setPathDragState({ startX: cx, startY: cy, originals });
                        }
                      }}
                    />
                    {/* Visible path */}
                    <path
                      d={d}
                      fill={path.fill}
                      stroke={path.stroke}
                      strokeWidth={path.strokeWidth}
                      strokeLinecap={path.strokeLinecap}
                      strokeLinejoin={path.strokeLinejoin}
                      pointerEvents="none"
                      vectorEffect="non-scaling-stroke"
                    />
                    {/* Node handles */}
                    {showHandles && path.points.map((point, pi) => {
                      const isSel = isSelected && pi === selectedPointIndex;
                      return (
                        <circle
                          key={`${path.id}:${pi}`}
                          cx={point.x}
                          cy={point.y}
                          r={isSel ? 5.5 : 4}
                          strokeWidth={1.5}
                          style={{
                            fill: isSel ? 'var(--lines-sel-primary)' : 'hsl(var(--foreground))',
                            stroke: 'hsl(var(--background))',
                            cursor: "grab",
                          }}
                          vectorEffect="non-scaling-stroke"
                          onPointerDown={(e) => {
                            if (activeTool !== "node") return;
                            e.stopPropagation();
                            selectPoint(path.id, pi);
                            setPointDragState({ pathId: path.id, pointIndex: pi });
                          }}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Crop overlay */}
        {activeTool === "crop" && cropRect && (() => {
          const { x, y, w, h } = cropRect;
          const hs = Math.max(6, 8 / viewport.zoom);
          const sw = 1 / viewport.zoom;
          const handles: { id: CropHandleDrag["handle"]; cx: number; cy: number; cursor: string }[] = [
            { id: "tl", cx: x,     cy: y,     cursor: "nwse-resize" },
            { id: "tc", cx: x+w/2, cy: y,     cursor: "ns-resize" },
            { id: "tr", cx: x+w,   cy: y,     cursor: "nesw-resize" },
            { id: "ml", cx: x,     cy: y+h/2, cursor: "ew-resize" },
            { id: "mr", cx: x+w,   cy: y+h/2, cursor: "ew-resize" },
            { id: "bl", cx: x,     cy: y+h,   cursor: "nesw-resize" },
            { id: "bc", cx: x+w/2, cy: y+h,   cursor: "ns-resize" },
            { id: "br", cx: x+w,   cy: y+h,   cursor: "nwse-resize" },
          ];
          const overlay = { fill: "rgba(0,0,0,0.55)", pointerEvents: "none" as const };
          return (
            <g>
              <rect x={0} y={0} width={canvasW} height={y} style={overlay} />
              <rect x={0} y={y+h} width={canvasW} height={Math.max(0, canvasH-(y+h))} style={overlay} />
              <rect x={0} y={y} width={x} height={h} style={overlay} />
              <rect x={x+w} y={y} width={Math.max(0, canvasW-(x+w))} height={h} style={overlay} />
              <rect x={x} y={y} width={w} height={h} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={sw} pointerEvents="none" />
              {handles.map(({ id, cx, cy, cursor }) => (
                <rect
                  key={id}
                  x={cx - hs/2} y={cy - hs/2} width={hs} height={hs}
                  fill="white" stroke="rgba(0,0,0,0.4)" strokeWidth={sw}
                  style={{ cursor }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const pt = svgToCanvasRef.current(e.clientX, e.clientY);
                    setCropHandleDrag({ handle: id, startX: pt.x, startY: pt.y, origRect: { ...cropRect } });
                  }}
                />
              ))}
            </g>
          );
        })()}

        {/* Rubber-band selection */}
        {rubberBand && (() => {
          const x = Math.min(rubberBand.x1, rubberBand.x2);
          const y = Math.min(rubberBand.y1, rubberBand.y2);
          const w = Math.abs(rubberBand.x2 - rubberBand.x1);
          const h = Math.abs(rubberBand.y2 - rubberBand.y1);
          return (
            <rect
              x={x} y={y} width={w} height={h}
              style={{ fill: 'var(--lines-sel-secondary)', stroke: 'var(--lines-sel-primary)' }}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          );
        })()}
      </svg>

      {activeTool === "crop" && (
        <div className="crop-hint">Drag handles to crop · Enter to commit · Esc to cancel</div>
      )}

      {!referenceImageUrl && (
        <div className="canvas-empty">
          <p className="canvas-empty-hint">Open an image to start tracing</p>
        </div>
      )}

      <div className="canvas-zoom-controls">
        <button className="zoom-btn" title="Zoom in (⌘=)" onClick={() => setViewport((c) => ({ ...c, zoom: clamp(c.zoom * 1.2, 0.1, 32) }))} type="button">+</button>
        <button className="zoom-btn" title="Fit (⌘0)" onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })} type="button">⊡</button>
        <button className="zoom-btn" title="Zoom out (⌘-)" onClick={() => setViewport((c) => ({ ...c, zoom: clamp(c.zoom / 1.2, 0.1, 32) }))} type="button">−</button>
      </div>
    </div>
    </ContextMenu.Trigger>
    <ContextMenu.Portal>
      <ContextMenu.Content className="ctx-menu">
        {selectedPathIds.length > 0 ? (
          <>
            <ContextMenu.Item className="ctx-item" onSelect={duplicateSelectedPaths}>
              Duplicate{selectedPathIds.length > 1 ? ` ${selectedPathIds.length} paths` : ""}
              <span className="ctx-hint">⌘D</span>
            </ContextMenu.Item>
            <ContextMenu.Separator className="ctx-sep" />
            <ContextMenu.Item className="ctx-item ctx-item--danger" onSelect={deleteSelectedPath}>
              Delete{selectedPathIds.length > 1 ? ` ${selectedPathIds.length} paths` : ""}
              <span className="ctx-hint">⌫</span>
            </ContextMenu.Item>
          </>
        ) : (
          <ContextMenu.Item className="ctx-item ctx-item--disabled" disabled>
            No selection
          </ContextMenu.Item>
        )}
      </ContextMenu.Content>
    </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
