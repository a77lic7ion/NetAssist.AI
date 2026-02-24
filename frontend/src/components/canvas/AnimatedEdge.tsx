import React from 'react';
import { BaseEdge, type EdgeProps, getSmoothStepPath, EdgeLabelRenderer } from '@xyflow/react';

export const AnimatedEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const { medium, state } = data as any;
  const isUp = state === 'up';

  const edgeColor = medium === 'fiber' ? '#f97316' : '#2563eb'; // Orange-500 or Blue-600

  return (
    <>
      {/* Glow layer */}
      <path
        d={edgePath}
        fill="none"
        stroke={edgeColor}
        strokeWidth={6}
        opacity={isUp ? 0.3 : 0.1}
        style={{ filter: 'blur(3px)' }}
      />

      {/* Main edge */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth: isUp ? 2 : 1,
          strokeDasharray: isUp ? 'none' : '5,5',
          opacity: isUp ? 1 : 0.6
        }}
      />

      {/* Animated flow */}
      {isUp && (
        <path
          d={edgePath}
          fill="none"
          stroke={edgeColor}
          strokeWidth={3}
          strokeDasharray="8 16"
          strokeOpacity={0.6}
          style={{
            animation: 'flow 1.5s linear infinite',
          }}
        />
      )}

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 10,
            pointerEvents: 'all',
          }}
          className="bg-white px-1 py-0.5 rounded border border-gray-200 shadow-sm font-mono text-[9px] z-10"
        >
          {data?.label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
