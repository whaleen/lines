import * as ContextMenu from "@radix-ui/react-context-menu";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { pointsToPathData } from "../lib/path-data";
import { useEditorStore } from "../store/editor-store";
import type { Point } from "../types/lines";

type PointDragState = { pathId: string; pointIndex: number };
type PathDragState = { startX: number; startY: number; originals: { pathId: string; points: Point[] }[] };
type PanState = { originX: number; originY: number; startX: number; startY: number };

const FREEHAND_THRESHOLD = 4; // canvas units between sampled points

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
  const [isDrawing, setIsDrawing] = useState(false);
  const lastDrawPoint = useRef<Point | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  const {
    activePathId,
    activeTool,
    addPointAt,
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
    setPathPoints,
    updatePoint,
  } = useEditorStore(
    useShallow((state) => ({
      activePathId: state.activePathId,
      activeTool: state.activeTool,
      addPointAt: state.addPointAt,
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
      setPathPoints: state.setPathPoints,
      updatePoint: state.updatePoint,
    })),
  );

  useEffect(() => {
    setViewport({ x: 0, y: 0, zoom: 1 });
  }, [document.sourceImage.height, document.sourceImage.width]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.code === "Space") setIsSpacePressed(true); };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.code === "Space") setIsSpacePressed(false); };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const viewBoxWidth = document.sourceImage.width / viewport.zoom;
  const viewBoxHeight = document.sourceImage.height / viewport.zoom;
  const maxX = Math.max(0, document.sourceImage.width - viewBoxWidth);
  const maxY = Math.max(0, document.sourceImage.height - viewBoxHeight);
  const viewBoxX = clamp(viewport.x, 0, maxX);
  const viewBoxY = clamp(viewport.y, 0, maxY);

  const svgToCanvas = (clientX: number, clientY: number): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const r = pt.matrixTransform(ctm.inverse());
    return { x: r.x, y: r.y };
  };

  // Stable ref so the effect doesn't re-run on every render
  const svgToCanvasRef = useRef(svgToCanvas);
  svgToCanvasRef.current = svgToCanvas;

  // Drag / pan / freehand window listeners
  useEffect(() => {
    if (!pointDragState && !pathDragState && !panState && !isDrawing) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!svgRef.current) return;
      const { x: cx, y: cy } = svgToCanvasRef.current(event.clientX, event.clientY);

      if (pointDragState) {
        updatePoint(pointDragState.pathId, pointDragState.pointIndex, {
          x: clamp(cx, 0, document.sourceImage.width),
          y: clamp(cy, 0, document.sourceImage.height),
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
        const cur = svgToCanvasRef.current(event.clientX, event.clientY);
        const origin = svgToCanvasRef.current(panState.startX, panState.startY);
        const deltaX = cur.x - origin.x;
        const deltaY = cur.y - origin.y;
        setViewport((v) => ({
          ...v,
          x: clamp(panState.originX - deltaX, 0, maxX),
          y: clamp(panState.originY - deltaY, 0, maxY),
        }));
      }

      if (isDrawing) {
        const pt = svgToCanvasRef.current(event.clientX, event.clientY);
        const clamped = {
          x: clamp(pt.x, 0, document.sourceImage.width),
          y: clamp(pt.y, 0, document.sourceImage.height),
        };
        if (!lastDrawPoint.current || dist(lastDrawPoint.current, clamped) >= FREEHAND_THRESHOLD) {
          addPointAt(clamped);
          lastDrawPoint.current = clamped;
        }
      }
    };

    const handlePointerUp = () => {
      if (isDrawing) {
        finishActivePath();
        setIsDrawing(false);
        lastDrawPoint.current = null;
      }
      setPointDragState(null);
      setPathDragState(null);
      setPanState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    addPointAt,
    document.sourceImage.height,
    document.sourceImage.width,
    finishActivePath,
    isDrawing,
    maxX,
    maxY,
    panState,
    pathDragState,
    pointDragState,
    setPathPoints,
    svgToCanvasRef.current,
    updatePoint,
  ]);


  const handleCanvasPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (isSpacePressed || event.button === 1) {
      setPanState({ originX: viewBoxX, originY: viewBoxY, startX: event.clientX, startY: event.clientY });
      event.preventDefault();
      return;
    }
    if (activeTool === "draw") {
      const pt = svgToCanvasRef.current(event.clientX, event.clientY);
      const clamped = {
        x: clamp(pt.x, 0, document.sourceImage.width),
        y: clamp(pt.y, 0, document.sourceImage.height),
      };
      addPointAt(clamped);
      lastDrawPoint.current = clamped;
      setIsDrawing(true);
    } else {
      deselectAll();
    }
  };

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const point = svgToCanvasRef.current(event.clientX, event.clientY);
    setViewport((cur) => {
      const nextZoom = clamp(cur.zoom * (event.deltaY > 0 ? 0.9 : 1.1), 0.25, 12);
      const nextWidth = document.sourceImage.width / nextZoom;
      const nextHeight = document.sourceImage.height / nextZoom;
      const curWidth = document.sourceImage.width / cur.zoom;
      const curHeight = document.sourceImage.height / cur.zoom;
      const curX = clamp(cur.x, 0, Math.max(0, document.sourceImage.width - curWidth));
      const curY = clamp(cur.y, 0, Math.max(0, document.sourceImage.height - curHeight));
      return {
        x: clamp(point.x - ((point.x - curX) / curWidth) * nextWidth, 0, Math.max(0, document.sourceImage.width - nextWidth)),
        y: clamp(point.y - ((point.y - curY) / curHeight) * nextHeight, 0, Math.max(0, document.sourceImage.height - nextHeight)),
        zoom: nextZoom,
      };
    });
  };

  const svgCursor =
    isSpacePressed || panState ? "grab" :
    activeTool === "draw" ? "crosshair" : "default";

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
        <rect fill="#0a0c10" height={document.sourceImage.height} width={document.sourceImage.width} pointerEvents="none" />
        {referenceImageUrl ? (
          <image
            height={document.sourceImage.height}
            href={referenceImageUrl}
            opacity={imageOpacity}
            pointerEvents="none"
            preserveAspectRatio="none"
            width={document.sourceImage.width}
          />
        ) : null}
        {document.paths.map((path) => {
          const isSelected = selectedPathIds.includes(path.id);
          const isPrimary = path.id === selectedPathId;
          const d = pointsToPathData(path.points, path.closed);
          const showHandles = activeTool === "node" && isPrimary;
          const pathCursor =
            activeTool === "draw" ? "crosshair" :
            activeTool === "select" ? "move" : "pointer";

          return (
            <g key={path.id}>
              {/* Selection halo */}
              {isSelected && activeTool === "select" && (
                <path
                  d={d}
                  fill="none"
                  pointerEvents="none"
                  stroke={isPrimary ? "rgba(140,161,255,0.45)" : "rgba(140,161,255,0.25)"}
                  strokeWidth={path.strokeWidth + 6}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {/* Wider invisible hit area */}
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(16, path.strokeWidth + 8)}
                style={{ cursor: activeTool === "draw" ? "crosshair" : pathCursor }}
                onPointerDown={(event) => {
                  if (activeTool === "draw") return;
                  event.stopPropagation();
                  selectPath(path.id, event.shiftKey);
                  if (activeTool === "select" && !event.shiftKey) {
                    const { x: cx, y: cy } = svgToCanvasRef.current(event.clientX, event.clientY);
                    // Capture original points for all selected paths (or just this one)
                    const dragIds = selectedPathIds.includes(path.id) ? selectedPathIds : [path.id];
                    const originals = document.paths
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
                pointerEvents="none"
                vectorEffect="non-scaling-stroke"
              />
              {/* Node handles */}
              {showHandles && path.points.map((point, pointIndex) => {
                const isSelectedPoint = isSelected && pointIndex === selectedPointIndex;
                return (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    fill={isSelectedPoint ? "#8ca1ff" : "#ffffff"}
                    key={`${path.id}:${pointIndex}`}
                    onPointerDown={(event) => {
                      if (activeTool !== "node") return;
                      event.stopPropagation();
                      selectPoint(path.id, pointIndex);
                      setPointDragState({ pathId: path.id, pointIndex });
                    }}
                    r={isSelectedPoint ? 5.5 : 4}
                    stroke="#0b1020"
                    strokeWidth={1.5}
                    style={{ cursor: activeTool === "node" ? "grab" : "default" }}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      {!referenceImageUrl && (
        <div className="canvas-empty">
          <p className="canvas-empty-hint">Open an image to start tracing</p>
        </div>
      )}
      <div className="canvas-zoom-controls">
        <button className="zoom-btn" title="Zoom in" onClick={() => setViewport((c) => ({ ...c, zoom: clamp(c.zoom * 1.2, 0.25, 12) }))} type="button">+</button>
        <button className="zoom-btn" title="Fit" onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })} type="button">⊡</button>
        <button className="zoom-btn" title="Zoom out" onClick={() => setViewport((c) => ({ ...c, zoom: clamp(c.zoom / 1.2, 0.25, 12) }))} type="button">−</button>
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
