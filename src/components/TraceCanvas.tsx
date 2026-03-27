import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { pointsToPathData } from "../lib/path-data";
import { useEditorStore } from "../store/editor-store";
import type { Point } from "../types/lines";

type PointDragState = { pathId: string; pointIndex: number };
type PathDragState = { pathId: string; startX: number; startY: number; originalPoints: Point[] };
type PanState = { originX: number; originY: number; startX: number; startY: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type TraceCanvasProps = { imageOpacity?: number };

export function TraceCanvas({ imageOpacity = 0.78 }: TraceCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [pointDragState, setPointDragState] = useState<PointDragState | null>(null);
  const [pathDragState, setPathDragState] = useState<PathDragState | null>(null);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  const {
    activePathId,
    activeTool,
    addPointAt,
    deselectAll,
    document,
    finishActivePath,
    referenceImageUrl,
    selectPath,
    selectPoint,
    selectedPathId,
    selectedPointIndex,
    setPathPoints,
    updatePoint,
  } = useEditorStore(
    useShallow((state) => ({
      activePathId: state.activePathId,
      activeTool: state.activeTool,
      addPointAt: state.addPointAt,
      deselectAll: state.deselectAll,
      document: state.document,
      finishActivePath: state.finishActivePath,
      referenceImageUrl: state.referenceImageUrl,
      selectPath: state.selectPath,
      selectPoint: state.selectPoint,
      selectedPathId: state.selectedPathId,
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

  useEffect(() => {
    if (!pointDragState && !pathDragState && !panState) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const cx = viewBoxX + ((event.clientX - rect.left) / rect.width) * viewBoxWidth;
      const cy = viewBoxY + ((event.clientY - rect.top) / rect.height) * viewBoxHeight;

      if (pointDragState) {
        updatePoint(pointDragState.pathId, pointDragState.pointIndex, {
          x: clamp(cx, 0, document.sourceImage.width),
          y: clamp(cy, 0, document.sourceImage.height),
        });
      }

      if (pathDragState) {
        const dx = cx - pathDragState.startX;
        const dy = cy - pathDragState.startY;
        setPathPoints(
          pathDragState.pathId,
          pathDragState.originalPoints.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        );
      }

      if (panState) {
        const deltaX = ((event.clientX - panState.startX) / rect.width) * viewBoxWidth;
        const deltaY = ((event.clientY - panState.startY) / rect.height) * viewBoxHeight;
        setViewport((cur) => ({
          ...cur,
          x: clamp(panState.originX - deltaX, 0, maxX),
          y: clamp(panState.originY - deltaY, 0, maxY),
        }));
      }
    };

    const handlePointerUp = () => {
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
    document.sourceImage.height,
    document.sourceImage.width,
    maxX,
    maxY,
    panState,
    pathDragState,
    pointDragState,
    setPathPoints,
    updatePoint,
    viewBoxHeight,
    viewBoxWidth,
    viewBoxX,
    viewBoxY,
  ]);

  const toCanvasPoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: viewBoxX + ((event.clientX - rect.left) / rect.width) * viewBoxWidth,
      y: viewBoxY + ((event.clientY - rect.top) / rect.height) * viewBoxHeight,
    };
  };

  const toCanvasPointFromClient = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: viewBoxX + ((clientX - rect.left) / rect.width) * viewBoxWidth,
      y: viewBoxY + ((clientY - rect.top) / rect.height) * viewBoxHeight,
    };
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.target !== event.currentTarget) return;
    if (isSpacePressed || event.button === 1) {
      setPanState({ originX: viewBoxX, originY: viewBoxY, startX: event.clientX, startY: event.clientY });
      setHoverPoint(null);
      event.preventDefault();
      return;
    }
    if (activeTool === "draw") {
      addPointAt(toCanvasPoint(event));
    } else {
      deselectAll();
    }
  };

  const activePath = document.paths.find((p) => p.id === activePathId || p.id === selectedPathId);
  const previewPath =
    activeTool === "draw" && activePathId && activePath && hoverPoint && activePath.points.length > 0
      ? pointsToPathData([...activePath.points, hoverPoint], false)
      : "";

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (activeTool === "draw" && !panState) setHoverPoint(toCanvasPoint(event));
  };

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const point = toCanvasPointFromClient(event.clientX, event.clientY);
    setViewport((cur) => {
      const nextZoom = clamp(cur.zoom * (event.deltaY > 0 ? 0.9 : 1.1), 0.25, 12);
      const nextWidth = document.sourceImage.width / nextZoom;
      const nextHeight = document.sourceImage.height / nextZoom;
      return {
        x: clamp(point.x - ((point.x - viewBoxX) / viewBoxWidth) * nextWidth, 0, Math.max(0, document.sourceImage.width - nextWidth)),
        y: clamp(point.y - ((point.y - viewBoxY) / viewBoxHeight) * nextHeight, 0, Math.max(0, document.sourceImage.height - nextHeight)),
        zoom: nextZoom,
      };
    });
  };

  const svgCursor = activeTool === "draw" ? "crosshair" : "default";

  return (
    <div className="canvas-frame">
      <svg
        className="canvas-svg"
        style={{ cursor: svgCursor }}
        onDoubleClick={() => { if (activeTool === "draw") finishActivePath(); }}
        onPointerMove={handlePointerMove}
        onPointerDown={handleCanvasPointerDown}
        onWheel={handleWheel}
        ref={svgRef}
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
      >
        <rect fill="#0a0c10" height={document.sourceImage.height} width={document.sourceImage.width} />
        {referenceImageUrl ? (
          <image
            height={document.sourceImage.height}
            href={referenceImageUrl}
            opacity={imageOpacity}
            preserveAspectRatio="none"
            width={document.sourceImage.width}
          />
        ) : null}
        {document.paths.map((path) => {
          const isSelected = path.id === selectedPathId;
          const d = pointsToPathData(path.points, path.closed);
          const showHandles =
            (activeTool === "node" && isSelected) ||
            (activeTool === "draw" && path.id === activePathId);
          const pathCursor =
            activeTool === "draw" ? "crosshair" :
            activeTool === "select" ? "move" : "pointer";

          return (
            <g key={path.id}>
              {/* Selection halo for select tool */}
              {isSelected && activeTool === "select" && (
                <path
                  d={d}
                  fill="none"
                  pointerEvents="none"
                  stroke="rgba(140,161,255,0.35)"
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
                  selectPath(path.id);
                  if (activeTool === "select") {
                    const rect = svgRef.current!.getBoundingClientRect();
                    const cx = viewBoxX + ((event.clientX - rect.left) / rect.width) * viewBoxWidth;
                    const cy = viewBoxY + ((event.clientY - rect.top) / rect.height) * viewBoxHeight;
                    setPathDragState({ pathId: path.id, startX: cx, startY: cy, originalPoints: [...path.points] });
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
        {previewPath ? (
          <path
            d={previewPath}
            fill="none"
            opacity={0.45}
            pointerEvents="none"
            stroke="#8ca1ff"
            strokeDasharray="6 6"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
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
  );
}
