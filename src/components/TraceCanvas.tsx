import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { pointsToPathData } from "../lib/path-data";
import { useEditorStore } from "../store/editor-store";
import type { Point } from "../types/lines";

type DragState = {
  pathId: string;
  pointIndex: number;
};

type PanState = {
  originX: number;
  originY: number;
  startX: number;
  startY: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function TraceCanvas() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [viewport, setViewport] = useState({
    x: 0,
    y: 0,
    zoom: 1,
  });
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
      updatePoint: state.updatePoint,
    })),
  );

  useEffect(() => {
    setViewport({
      x: 0,
      y: 0,
      zoom: 1,
    });
  }, [document.sourceImage.height, document.sourceImage.width]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        setIsSpacePressed(false);
      }
    };

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
    if (!dragState && !panState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!svgRef.current) {
        return;
      }

      const rect = svgRef.current.getBoundingClientRect();

      if (dragState) {
        const x = clamp(
          viewBoxX + ((event.clientX - rect.left) / rect.width) * viewBoxWidth,
          0,
          document.sourceImage.width,
        );
        const y = clamp(
          viewBoxY + ((event.clientY - rect.top) / rect.height) * viewBoxHeight,
          0,
          document.sourceImage.height,
        );

        updatePoint(dragState.pathId, dragState.pointIndex, { x, y });
      }

      if (panState) {
        const deltaX = ((event.clientX - panState.startX) / rect.width) * viewBoxWidth;
        const deltaY = ((event.clientY - panState.startY) / rect.height) * viewBoxHeight;

        setViewport((current) => ({
          ...current,
          x: clamp(panState.originX - deltaX, 0, maxX),
          y: clamp(panState.originY - deltaY, 0, maxY),
        }));
      }
    };

    const handlePointerUp = () => {
      setDragState(null);
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
    dragState,
    maxX,
    maxY,
    panState,
    updatePoint,
    viewBoxHeight,
    viewBoxWidth,
    viewBoxX,
    viewBoxY,
  ]);

  const toCanvasPoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = viewBoxX + ((event.clientX - rect.left) / rect.width) * viewBoxWidth;
    const y = viewBoxY + ((event.clientY - rect.top) / rect.height) * viewBoxHeight;

    return { x, y };
  };

  const toCanvasPointFromClient = (clientX: number, clientY: number) => {
    if (!svgRef.current) {
      return { x: 0, y: 0 };
    }

    const rect = svgRef.current.getBoundingClientRect();
    const x = viewBoxX + ((clientX - rect.left) / rect.width) * viewBoxWidth;
    const y = viewBoxY + ((clientY - rect.top) / rect.height) * viewBoxHeight;

    return { x, y };
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (isSpacePressed || event.button === 1) {
      setPanState({
        originX: viewBoxX,
        originY: viewBoxY,
        startX: event.clientX,
        startY: event.clientY,
      });
      setHoverPoint(null);
      event.preventDefault();
      return;
    }

    if (activeTool !== "draw") {
      deselectAll();
      return;
    }

    addPointAt(toCanvasPoint(event));
  };

  const activePath = document.paths.find(
    (path) => path.id === activePathId || path.id === selectedPathId,
  );
  const previewPath =
    activeTool === "draw" &&
    activePathId &&
    activePath &&
    hoverPoint &&
    activePath.points.length > 0
      ? pointsToPathData([...activePath.points, hoverPoint], false)
      : "";

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (activeTool === "draw" && !panState) {
      setHoverPoint(toCanvasPoint(event));
    }
  };

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const point = toCanvasPointFromClient(event.clientX, event.clientY);

    setViewport((current) => {
      const nextZoom = clamp(current.zoom * (event.deltaY > 0 ? 0.9 : 1.1), 0.5, 8);
      const nextWidth = document.sourceImage.width / nextZoom;
      const nextHeight = document.sourceImage.height / nextZoom;
      const nextX = clamp(
        point.x - ((point.x - viewBoxX) / viewBoxWidth) * nextWidth,
        0,
        Math.max(0, document.sourceImage.width - nextWidth),
      );
      const nextY = clamp(
        point.y - ((point.y - viewBoxY) / viewBoxHeight) * nextHeight,
        0,
        Math.max(0, document.sourceImage.height - nextHeight),
      );

      return {
        x: nextX,
        y: nextY,
        zoom: nextZoom,
      };
    });
  };

  return (
    <div className="canvas-frame">
      <div className="canvas-controls">
        <button
          className="tool-button"
          onClick={() =>
            setViewport((current) => ({ ...current, zoom: clamp(current.zoom * 1.15, 0.5, 8) }))
          }
          type="button"
        >
          +
        </button>
        <button
          className="tool-button"
          onClick={() =>
            setViewport((current) => ({ ...current, zoom: clamp(current.zoom / 1.15, 0.5, 8) }))
          }
          type="button"
        >
          -
        </button>
        <button
          className="tool-button"
          onClick={() =>
            setViewport({
              x: 0,
              y: 0,
              zoom: 1,
            })
          }
          type="button"
        >
          Reset
        </button>
      </div>
      <svg
        className="canvas-svg"
        onDoubleClick={() => {
          if (activeTool === "draw") {
            finishActivePath();
          }
        }}
        onPointerMove={handlePointerMove}
        onPointerDown={handleCanvasPointerDown}
        onWheel={handleWheel}
        ref={svgRef}
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
      >
        <rect
          fill="rgba(6,8,12,0.92)"
          height={document.sourceImage.height}
          width={document.sourceImage.width}
        />
        {referenceImageUrl ? (
          <image
            height={document.sourceImage.height}
            href={referenceImageUrl}
            opacity={0.78}
            preserveAspectRatio="none"
            width={document.sourceImage.width}
          />
        ) : null}
        {document.paths.map((path) => {
          const isSelected = path.id === selectedPathId;
          const d = pointsToPathData(path.points, path.closed);

          return (
            <g key={path.id}>
              <path
                d={d}
                fill="none"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  selectPath(path.id);
                }}
                stroke={path.stroke}
                strokeWidth={path.strokeWidth}
                style={{ cursor: "pointer" }}
                vectorEffect="non-scaling-stroke"
              />
              {path.points.map((point, pointIndex) => {
                const isSelectedPoint = isSelected && pointIndex === selectedPointIndex;

                return (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    fill={isSelectedPoint ? "#8ca1ff" : "#ffffff"}
                    key={`${path.id}:${pointIndex}`}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      selectPoint(path.id, pointIndex);
                      if (activeTool === "select") {
                        setDragState({ pathId: path.id, pointIndex });
                      }
                    }}
                    r={isSelectedPoint ? 6 : 4.25}
                    stroke="#0b1020"
                    strokeWidth={1.5}
                    style={{ cursor: activeTool === "select" ? "grab" : "default" }}
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
            strokeDasharray="8 8"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      {!referenceImageUrl ? (
        <div className="canvas-empty">
          <div>
            <p className="eyebrow">No Reference</p>
            <p className="muted-copy">
              Load an image to start tracing. The exported component only includes the SVG paths,
              not the background image.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
